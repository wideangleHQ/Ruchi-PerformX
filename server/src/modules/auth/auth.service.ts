import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { VerifyResetOtpDto } from './dto/verify-reset-otp.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { role_enum } from '../../../generated/prisma/client';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  private readonly OTP_EXPIRY_MINUTES = 10;
  private readonly MAX_OTP_ATTEMPTS = 5;
  private readonly BCRYPT_ROUNDS = 12;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly emailService: EmailService,
  ) {}

  // ─── LOGIN ───────────────────────────────────────────────────────────────────

  async login(dto: LoginDto) {
    const user = await this.prisma.users.findUnique({
      where: { username: dto.username },
      select: {
        id: true,
        username: true,
        passwordHash: true,
        role: true,
        fullName: true,
        departmentId: true,
        isActive: true,
        isEmailVerified: true,
        pendingApproval: true,
      },
    });

    if (!user) throw new UnauthorizedException('Invalid credentials');

    const passwordMatch = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordMatch) throw new UnauthorizedException('Invalid credentials');

    if (!user.isEmailVerified)
      throw new UnauthorizedException('Email not verified. Please verify your OTP first.');

    if (user.pendingApproval)
      throw new UnauthorizedException('Account pending HOD approval.');

    if (!user.isActive)
      throw new UnauthorizedException('Account is inactive. Contact administrator.');

    const payload = {
      sub: user.id,
      username: user.username,
      role: user.role,
      departmentId: user.departmentId,
      fullName: user.fullName,
    };

    return {
      accessToken: this.jwtService.sign(payload),
      userId: user.id,
      username: user.username,
      role: user.role,
    };
  }

  // ─── REGISTER ────────────────────────────────────────────────────────────────

  async register(dto: RegisterDto) {
    const existing = await this.prisma.users.findFirst({
      where: {
        OR: [{ username: dto.username }, { email: dto.email }],
      },
    });

    if (existing) throw new ConflictException('Username or email already exists');

    if (dto.role === role_enum.ADMIN)
      throw new BadRequestException('Cannot self-register as ADMIN');

    const passwordHash = await bcrypt.hash(dto.password, this.BCRYPT_ROUNDS);

    await this.prisma.users.create({
      data: {
        username: dto.username,
        email: dto.email,
        full_name: dto.fullName,
        password_hash: passwordHash,
        role: dto.role,
        departmentId: dto.departmentId ?? null,
        isActive: false,
        isEmailVerified: false,
        pendingApproval: false,
      },
    });

    await this.sendOtp(dto.email, 'REGISTRATION');

    return { message: 'Registration successful. Please verify your email with the OTP sent.' };
  }

 
  async verifyOtp(dto: VerifyOtpDto) {
    const record = await this.getValidOtpRecord(dto.email, 'REGISTRATION');

    await this.validateOtpAttempt(record, dto.otp);

    const user = await this.prisma.users.findUnique({
      where: { email: dto.email },
      select: { id: true, role: true },
    });

    if (!user) throw new NotFoundException('User not found');

    const requiresHodApproval = user.role === role_enum.EMPLOYEE;

    await this.prisma.users.update({
      where: { id: user.id },
      data: {
        email_verified_at: new Date(),
        pendingApproval: requiresHodApproval,
        isActive: !requiresHodApproval,
      },
    });

    await this.prisma.otpVerification.update({
      where: { id: record.id },
      data: { isUsed: true },
    });

    return requiresHodApproval
      ? { message: 'Email verified. Your account is pending HOD approval.' }
      : { message: 'Email verified. You can now login.' };
  }

  // ─── FORGOT PASSWORD ──────────────────────────────────────────────────────────

  async forgotPassword(dto: ForgotPasswordDto) {
    const user = await this.prisma.users.findUnique({
      where: { email: dto.email },
      select: { id: true },
    });

    // Always return same message — prevents email enumeration
    if (!user) return { message: 'If this email exists, an OTP has been sent.' };

    await this.sendOtp(dto.email, 'PASSWORD_RESET');

    return { message: 'If this email exists, an OTP has been sent.' };
  }

  // ─── VERIFY RESET OTP ────────────────────────────────────────────────────────

  async verifyResetOtp(dto: VerifyResetOtpDto) {
    const record = await this.getValidOtpRecord(dto.email, 'PASSWORD_RESET');

    await this.validateOtpAttempt(record, dto.otp);

    await this.prisma.otpVerification.update({
      where: { id: record.id },
      data: { isUsed: true },
    });

    return { message: 'OTP verified. You may now reset your password.' };
  }

  // ─── RESET PASSWORD ───────────────────────────────────────────────────────────

  async resetPassword(dto: ResetPasswordDto) {
    const user = await this.prisma.users.findUnique({
      where: { email: dto.email },
      select: { id: true },
    });

    if (!user) throw new NotFoundException('User not found');

    // Ensure reset OTP was verified
    const verifiedOtp = await this.prisma.otpVerification.findFirst({
      where: {
        email: dto.email,
        type: 'PASSWORD_RESET',
        isUsed: true,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!verifiedOtp)
      throw new BadRequestException('OTP not verified. Please verify your OTP first.');

    const passwordHash = await bcrypt.hash(dto.newPassword, this.BCRYPT_ROUNDS);

    await this.prisma.users.update({
      where: { id: user.id },
      data: { password_hash: passwordHash },
    });

    return { message: 'Password reset successful. You can now login.' };
  }

  // ─── PRIVATE HELPERS ─────────────────────────────────────────────────────────

  private generateOtp(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  private async sendOtp(email: string, type: 'REGISTRATION' | 'PASSWORD_RESET'): Promise<void> {
    // Invalidate any existing unused OTPs for this email + type
    await this.prisma.otpVerification.updateMany({
      where: { email, type, isUsed: false },
      data: { isUsed: true },
    });

    const otp = this.generateOtp();
    const otpHash = await bcrypt.hash(otp, this.BCRYPT_ROUNDS);
    const expiresAt = new Date(Date.now() + this.OTP_EXPIRY_MINUTES * 60 * 1000);

    await this.prisma.otpVerification.create({
      data: { email, otpHash, type, expiresAt },
    });

    await this.emailService.sendOtpEmail(email, otp, type);
  }

  private async getValidOtpRecord(email: string, type: 'REGISTRATION' | 'PASSWORD_RESET') {
    const record = await this.prisma.otpVerification.findFirst({
      where: {
        email,
        type,
        isUsed: false,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!record) throw new BadRequestException('OTP is invalid or has expired.');

    return record;
  }

  private async validateOtpAttempt(record: any, submittedOtp: string): Promise<void> {
    if (record.attempts >= this.MAX_OTP_ATTEMPTS) {
      throw new BadRequestException('Maximum OTP attempts exceeded. Please request a new OTP.');
    }

    const isMatch = await bcrypt.compare(submittedOtp, record.otpHash);

    if (!isMatch) {
      await this.prisma.otpVerification.update({
        where: { id: record.id },
        data: { attempts: { increment: 1 } },
      });
      throw new BadRequestException('Invalid OTP.');
    }
  }
}
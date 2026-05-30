import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { Resend } from 'resend';
import dotenv from 'dotenv';
dotenv.config();

@Injectable()
export class EmailService {
  private readonly resend: Resend;
  private readonly logger = new Logger(EmailService.name);
  private readonly fromEmail = process.env.RESEND_FROM_EMAIL ?? 'ruchifoodline.connect@gmail.com';

  constructor() {
    this.resend = new Resend(process.env.RESEND_API_KEY);
  }

  async sendOtpEmail(email: string, otp: string, type: 'REGISTRATION' | 'PASSWORD_RESET'): Promise<void> {
    const subject = type === 'REGISTRATION'
      ? 'RUCHI PerformX — Verify Your Email'
      : 'RUCHI PerformX — Password Reset OTP';

    const heading = type === 'REGISTRATION'
      ? 'Email Verification'
      : 'Password Reset';

    const message = type === 'REGISTRATION'
      ? 'Use the OTP below to verify your email and complete registration.'
      : 'Use the OTP below to reset your password.';

    try {
      await this.resend.emails.send({
        from: this.fromEmail,
        to: email,
        subject,
        html: this.buildOtpTemplate(heading, message, otp),
      });
    } catch (error) {
      this.logger.error(`Failed to send ${type} email to ${email}`, error);
      throw new InternalServerErrorException('Failed to send email. Please try again.');
    }
  }

  private buildOtpTemplate(heading: string, message: string, otp: string): string {
    return `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#0a1628;color:#e8eef8;border-radius:12px;">
        <h2 style="color:#e8502a;margin-bottom:8px;">RUCHI PerformX</h2>
        <h3 style="margin-bottom:16px;">${heading}</h3>
        <p style="color:#8ba4c8;margin-bottom:24px;">${message}</p>
        <div style="background:#1a3460;border-radius:8px;padding:24px;text-align:center;letter-spacing:8px;font-size:32px;font-weight:800;color:#f0a500;">
          ${otp}
        </div>
        <p style="color:#8ba4c8;margin-top:24px;font-size:12px;">This OTP expires in <strong>10 minutes</strong>. Do not share it with anyone.</p>
        <p style="color:#8ba4c8;font-size:12px;">If you did not request this, please ignore this email.</p>
      </div>
    `;
  }
}
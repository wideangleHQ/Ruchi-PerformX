import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../../common/types/jwt-payload.type';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @Public()
  @Get('check-md')
  async checkMd() {
    const exists = await this.authService.checkMdExists();
    return { exists };
  }

  @Public()
  @Get('departments')
  getDepartments() {
    return this.authService.getDepartments();
  }

  @Public()
  @Get('check-hod/:departmentId')
  async checkHod(@Param('departmentId') departmentId: string) {
    const exists = await this.authService.checkHodExists(departmentId);
    return { exists };
  }

  @Public()
  @Get('check-hod-name/:departmentName')
  async checkHodByName(@Param('departmentName') departmentName: string) {
    const exists = await this.authService.checkHodExistsByName(departmentName);
    return { exists };
  }

  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  changePassword(
    @CurrentUser() user: JwtPayload,
    @Body('newPassword') newPassword: string,
  ) {
    return this.authService.changePassword(user.sub, newPassword);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  logout() {
    return { message: 'Logged out successfully' };
  }

  @Get('me')
  me(@CurrentUser() user: JwtPayload) {
    return user;
  }
}

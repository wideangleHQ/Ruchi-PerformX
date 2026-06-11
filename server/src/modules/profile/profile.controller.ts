import { Controller, Get, Patch, Body, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ProfileService } from './profile.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ProfileResponseDto } from './dto/profile.dto';
import { JwtAuthGuard } from '../../common/gaurds/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../../common/types/jwt-payload.type';

@Controller('profile')
@UseGuards(JwtAuthGuard)
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  async getProfile(@CurrentUser() user: JwtPayload): Promise<ProfileResponseDto> {
    return this.profileService.getProfile(user.sub);
  }

  @Patch()
  @HttpCode(HttpStatus.OK)
  async updateProfile(
    @Body() dto: UpdateProfileDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<ProfileResponseDto> {
    return this.profileService.updateProfile(user.sub, dto);
  }
}

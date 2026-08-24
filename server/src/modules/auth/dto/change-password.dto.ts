import { IsNotEmpty, IsString, MinLength } from 'class-validator';

/**
 * `currentPassword` is what makes this a password change rather than a password
 * takeover. The route only had `@Body('newPassword')` before, so anybody holding
 * a live session could set a new password without knowing the old one and lock
 * the owner out: a borrowed laptop or a lifted token was enough.
 *
 * `MinLength(8)` matches `RegisterDto`. Without it this route was the way round
 * the only password rule the product has.
 */
export class ChangePasswordDto {
  @IsString()
  @IsNotEmpty()
  currentPassword!: string;

  @IsString()
  @MinLength(8, { message: 'New password must be at least 8 characters' })
  newPassword!: string;
}

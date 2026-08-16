import { outcome_type_enum } from '@prisma/client';
import { IsEnum, IsNotEmpty, IsString, MaxLength } from 'class-validator';

/**
 * A TRY, a FAILURE, or an OUTCOME.
 *
 * `entry_type` is required and has no default. The three kinds are the point of
 * the table, so the caller states which one it is rather than falling into
 * whichever the server would have picked.
 */
export class CreateOutcomeDto {
  @IsEnum(outcome_type_enum, {
    message: 'entry_type must be one of TRY, FAILURE, OUTCOME',
  })
  entry_type!: outcome_type_enum;

  @IsString()
  @IsNotEmpty({ message: 'Content is required' })
  @MaxLength(4000)
  content!: string;
}

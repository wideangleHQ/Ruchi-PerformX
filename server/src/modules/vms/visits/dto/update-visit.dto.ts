import { Exclude, Expose } from 'class-transformer';
import { PartialType } from './swagger-compat';
import { CreateVisitDto } from './create-visit.dto';

@Exclude()
export class UpdateVisitDto extends PartialType(CreateVisitDto) {
  @Expose()
  visitorId?: string;

  @Expose()
  hostEmployeeId?: string;

  @Expose()
  purpose?: string;

  @Expose()
  meetingDetails?: string;

  @Expose()
  scheduledAt?: string;
}


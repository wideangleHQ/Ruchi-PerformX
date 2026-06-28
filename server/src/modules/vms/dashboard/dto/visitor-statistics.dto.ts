import { Exclude, Expose } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

@Exclude()
export class VisitorStatisticsDto {
  @ApiProperty()
  @Expose()
  date!: string;

  @ApiProperty()
  @Expose()
  count!: number;
}

@Exclude()
export class StatisticsResponseDto {
  @ApiProperty({ type: [VisitorStatisticsDto] })
  @Expose()
  daily!: VisitorStatisticsDto[];

  @ApiProperty({ type: [VisitorStatisticsDto] })
  @Expose()
  weekly!: VisitorStatisticsDto[];

  @ApiProperty({ type: [VisitorStatisticsDto] })
  @Expose()
  monthly!: VisitorStatisticsDto[];
}

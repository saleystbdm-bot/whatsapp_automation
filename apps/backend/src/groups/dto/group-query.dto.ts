import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';
import { GroupType } from '../../common/enums/group-type.enum';

function parseBoolean({ value }: { value: unknown }): unknown {
  if (typeof value !== 'string') return value;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return value;
}

export class GroupQueryDto {
  @ApiPropertyOptional({
    description:
      'Filter by monitoring status (true = monitored, false = not monitored)',
  })
  @IsOptional()
  @Transform(parseBoolean)
  @IsBoolean()
  active?: boolean;

  @ApiPropertyOptional({ enum: GroupType })
  @IsOptional()
  @IsEnum(GroupType)
  type?: GroupType;

  @ApiPropertyOptional({
    description: 'Case-insensitive search over group name',
    example: 'client',
  })
  @IsOptional()
  @IsString()
  search?: string;
}

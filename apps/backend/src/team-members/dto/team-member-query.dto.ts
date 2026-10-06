import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

function parseBoolean({ value }: { value: unknown }): unknown {
  if (typeof value !== 'string') return value;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return value;
}

export class TeamMemberQueryDto {
  @ApiPropertyOptional({ description: 'Filter by active status' })
  @IsOptional()
  @Transform(parseBoolean)
  @IsBoolean()
  active?: boolean;

  @ApiPropertyOptional({
    description: 'Case-insensitive search over name or phone',
    example: 'harish',
  })
  @IsOptional()
  @IsString()
  search?: string;
}

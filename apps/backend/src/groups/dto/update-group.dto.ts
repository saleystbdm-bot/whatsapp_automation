import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { GroupType } from '../../common/enums/group-type.enum';
import { TrimString } from '../../common/validators/trim-string.decorator';

export class UpdateGroupDto {
  @ApiPropertyOptional({ example: 'Client ABC' })
  @IsOptional()
  @TrimString()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @ApiPropertyOptional({ enum: GroupType })
  @IsOptional()
  @IsEnum(GroupType)
  type?: GroupType;

  @ApiPropertyOptional({ example: 30, minimum: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  slaMinutes?: number;

  @ApiPropertyOptional({
    description:
      'true = monitored ("Monitor"), false = not monitored ("Remove")',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

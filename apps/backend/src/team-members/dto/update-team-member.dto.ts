import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';
import { E164_PHONE_REGEX } from '../../common/constants/phone.constant';
import { TrimString } from '../../common/validators/trim-string.decorator';

export class UpdateTeamMemberDto {
  @ApiPropertyOptional({ example: 'Harish' })
  @IsOptional()
  @TrimString()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @ApiPropertyOptional({
    example: '+919566831192',
    description: 'Canonical E.164 format',
  })
  @IsOptional()
  @Matches(E164_PHONE_REGEX, {
    message: 'phone must be in E.164 format, e.g. +919566831192',
  })
  phone?: string;

  @ApiPropertyOptional({ example: 'Developer' })
  @IsOptional()
  @IsString()
  role?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

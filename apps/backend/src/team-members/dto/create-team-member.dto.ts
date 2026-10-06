import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';
import { E164_PHONE_REGEX } from '../../common/constants/phone.constant';
import { TrimString } from '../../common/validators/trim-string.decorator';

export class CreateTeamMemberDto {
  @ApiProperty({ example: 'Harish' })
  @TrimString()
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    example: '+919566831192',
    description: 'Canonical E.164 format',
  })
  @Matches(E164_PHONE_REGEX, {
    message: 'phone must be in E.164 format, e.g. +919566831192',
  })
  phone: string;

  @ApiPropertyOptional({ example: 'Developer' })
  @IsOptional()
  @IsString()
  role?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

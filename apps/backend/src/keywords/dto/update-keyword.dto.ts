import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { TrimString } from '../../common/validators/trim-string.decorator';

export class UpdateKeywordDto {
  @ApiPropertyOptional({ example: 'urgent' })
  @IsOptional()
  @TrimString()
  @IsString()
  @IsNotEmpty()
  keyword?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

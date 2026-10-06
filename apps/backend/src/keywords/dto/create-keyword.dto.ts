import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';
import { TrimString } from '../../common/validators/trim-string.decorator';

export class CreateKeywordDto {
  @ApiProperty({
    example: 'Payment',
    description: 'Normalized to lowercase/trimmed on save',
  })
  @TrimString()
  @IsString()
  @IsNotEmpty()
  keyword: string;
}

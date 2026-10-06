import { ApiProperty } from '@nestjs/swagger';
import { Keyword } from '../entities/keyword.entity';

export class KeywordResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid' })
  groupId: string;

  @ApiProperty()
  keyword: string;

  @ApiProperty()
  active: boolean;
}

export function toKeywordResponseDto(keyword: Keyword): KeywordResponseDto {
  return {
    id: keyword.id,
    groupId: keyword.groupId,
    keyword: keyword.keyword,
    active: keyword.active,
  };
}

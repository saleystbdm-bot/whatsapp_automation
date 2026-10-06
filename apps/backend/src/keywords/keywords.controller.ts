import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CreateKeywordDto } from './dto/create-keyword.dto';
import { UpdateKeywordDto } from './dto/update-keyword.dto';
import { KeywordsService } from './keywords.service';
import { KeywordResponseDto } from './serializers/keyword.serializer';

@ApiTags('keywords')
@Controller('groups/:groupId/keywords')
export class KeywordsController {
  constructor(private readonly keywordsService: KeywordsService) {}

  @Get()
  @ApiOperation({
    summary: 'List all keywords (including inactive) for a group',
  })
  @ApiParam({ name: 'groupId', format: 'uuid' })
  @ApiResponse({ status: HttpStatus.OK, type: [KeywordResponseDto] })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Group not found' })
  findAll(
    @Param('groupId', ParseUUIDPipe) groupId: string,
  ): Promise<KeywordResponseDto[]> {
    return this.keywordsService.findAllForGroup(groupId);
  }

  @Post()
  @ApiOperation({
    summary: 'Add a keyword to a group',
    description:
      'Normalized to lowercase/trimmed. Re-adding a previously deactivated keyword is allowed.',
  })
  @ApiParam({ name: 'groupId', format: 'uuid' })
  @ApiResponse({ status: HttpStatus.CREATED, type: KeywordResponseDto })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Group not found' })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'Duplicate active keyword',
  })
  create(
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Body() dto: CreateKeywordDto,
  ): Promise<KeywordResponseDto> {
    return this.keywordsService.create(groupId, dto);
  }

  @Patch(':keywordId')
  @ApiOperation({ summary: 'Update or (de)activate a keyword' })
  @ApiParam({ name: 'groupId', format: 'uuid' })
  @ApiParam({ name: 'keywordId', format: 'uuid' })
  @ApiResponse({ status: HttpStatus.OK, type: KeywordResponseDto })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Group or keyword not found',
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'Duplicate active keyword',
  })
  update(
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Param('keywordId', ParseUUIDPipe) keywordId: string,
    @Body() dto: UpdateKeywordDto,
  ): Promise<KeywordResponseDto> {
    return this.keywordsService.update(groupId, keywordId, dto);
  }

  @Delete(':keywordId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a keyword' })
  @ApiParam({ name: 'groupId', format: 'uuid' })
  @ApiParam({ name: 'keywordId', format: 'uuid' })
  @ApiResponse({ status: HttpStatus.NO_CONTENT })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Group or keyword not found',
  })
  remove(
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Param('keywordId', ParseUUIDPipe) keywordId: string,
  ): Promise<void> {
    return this.keywordsService.remove(groupId, keywordId);
  }
}

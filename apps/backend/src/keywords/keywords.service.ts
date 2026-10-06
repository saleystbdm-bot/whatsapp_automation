import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { isUniqueViolation } from '../common/database/postgres-error.util';
import { Group } from '../groups/entities/group.entity';
import { CreateKeywordDto } from './dto/create-keyword.dto';
import { UpdateKeywordDto } from './dto/update-keyword.dto';
import { Keyword } from './entities/keyword.entity';
import {
  KeywordResponseDto,
  toKeywordResponseDto,
} from './serializers/keyword.serializer';

function normalize(keyword: string): string {
  return keyword.trim().toLowerCase();
}

@Injectable()
export class KeywordsService {
  constructor(
    @InjectRepository(Keyword)
    private readonly keywords: Repository<Keyword>,
    @InjectRepository(Group)
    private readonly groups: Repository<Group>,
  ) {}

  async findAllForGroup(groupId: string): Promise<KeywordResponseDto[]> {
    await this.assertGroupExists(groupId);
    const keywords = await this.keywords.find({
      where: { groupId },
      order: { createdAt: 'ASC' },
    });
    return keywords.map(toKeywordResponseDto);
  }

  async create(
    groupId: string,
    dto: CreateKeywordDto,
  ): Promise<KeywordResponseDto> {
    await this.assertGroupExists(groupId);

    const keyword = this.keywords.create({
      groupId,
      keyword: normalize(dto.keyword),
      active: true,
    });

    try {
      const saved = await this.keywords.save(keyword);
      return toKeywordResponseDto(saved);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException(
          `An active keyword "${normalize(dto.keyword)}" already exists for this group`,
        );
      }
      throw error;
    }
  }

  async update(
    groupId: string,
    keywordId: string,
    dto: UpdateKeywordDto,
  ): Promise<KeywordResponseDto> {
    const keyword = await this.getEntityOrThrow(groupId, keywordId);

    if (dto.keyword !== undefined) keyword.keyword = normalize(dto.keyword);
    if (dto.active !== undefined) keyword.active = dto.active;

    try {
      const saved = await this.keywords.save(keyword);
      return toKeywordResponseDto(saved);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException(
          `An active keyword "${keyword.keyword}" already exists for this group`,
        );
      }
      throw error;
    }
  }

  async remove(groupId: string, keywordId: string): Promise<void> {
    const keyword = await this.getEntityOrThrow(groupId, keywordId);
    await this.keywords.delete(keyword.id);
  }

  private async getEntityOrThrow(
    groupId: string,
    keywordId: string,
  ): Promise<Keyword> {
    await this.assertGroupExists(groupId);
    const keyword = await this.keywords.findOneBy({ id: keywordId, groupId });
    if (!keyword) {
      throw new NotFoundException(
        `Keyword ${keywordId} not found for group ${groupId}`,
      );
    }
    return keyword;
  }

  private async assertGroupExists(groupId: string): Promise<void> {
    const exists = await this.groups.exists({ where: { id: groupId } });
    if (!exists) {
      throw new NotFoundException(`Group ${groupId} not found`);
    }
  }
}

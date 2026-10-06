import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Group } from '../groups/entities/group.entity';
import { Keyword } from './entities/keyword.entity';
import { KeywordsController } from './keywords.controller';
import { KeywordsService } from './keywords.service';

@Module({
  imports: [TypeOrmModule.forFeature([Keyword, Group])],
  controllers: [KeywordsController],
  providers: [KeywordsService],
  exports: [KeywordsService, TypeOrmModule],
})
export class KeywordsModule {}

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GroupsModule } from '../groups/groups.module';
import { SlaIncident } from '../sla/entities/sla-incident.entity';
import { Issue } from './entities/issue.entity';
import { IssuesController } from './issues.controller';
import { IssuesService } from './issues.service';

@Module({
  imports: [TypeOrmModule.forFeature([Issue, SlaIncident]), GroupsModule],
  controllers: [IssuesController],
  providers: [IssuesService],
  exports: [IssuesService, TypeOrmModule],
})
export class IssuesModule {}

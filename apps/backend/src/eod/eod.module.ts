import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GroupMember } from '../groups/entities/group-member.entity';
import { GroupsModule } from '../groups/groups.module';
import { Notification } from '../notifications/entities/notification.entity';
import { TeamMembersModule } from '../team-members/team-members.module';
import { EodController } from './eod.controller';
import { EodReport } from './entities/eod-report.entity';
import { EodService } from './eod.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([EodReport, GroupMember, Notification]),
    GroupsModule,
    TeamMembersModule,
  ],
  controllers: [EodController],
  providers: [EodService],
  exports: [EodService, TypeOrmModule],
})
export class EodModule {}

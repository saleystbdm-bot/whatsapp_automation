import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TeamMembersModule } from '../team-members/team-members.module';
import { GroupMember } from './entities/group-member.entity';
import { Group } from './entities/group.entity';
import { GroupMembersController } from './group-members.controller';
import { GroupsController } from './groups.controller';
import { GroupsService } from './groups.service';
import { GroupsSyncService } from './groups-sync.service';
import { WassengerClientService } from './wassenger/wassenger-client.service';

@Module({
  imports: [TypeOrmModule.forFeature([Group, GroupMember]), TeamMembersModule],
  controllers: [GroupsController, GroupMembersController],
  providers: [GroupsService, GroupsSyncService, WassengerClientService],
  exports: [GroupsService, TypeOrmModule],
})
export class GroupsModule {}

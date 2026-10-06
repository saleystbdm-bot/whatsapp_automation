import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TeamMember } from './entities/team-member.entity';
import { TeamMembersController } from './team-members.controller';
import { TeamMembersService } from './team-members.service';

@Module({
  imports: [TypeOrmModule.forFeature([TeamMember])],
  controllers: [TeamMembersController],
  providers: [TeamMembersService],
  exports: [TeamMembersService, TypeOrmModule],
})
export class TeamMembersModule {}

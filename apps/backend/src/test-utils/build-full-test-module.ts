import { ConfigModule } from '@nestjs/config';
import { Test, TestingModuleBuilder } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EodReport } from '../eod/entities/eod-report.entity';
import { EodModule } from '../eod/eod.module';
import { GroupMember } from '../groups/entities/group-member.entity';
import { Group } from '../groups/entities/group.entity';
import { GroupsModule } from '../groups/groups.module';
import { Issue } from '../issues/entities/issue.entity';
import { IssuesModule } from '../issues/issues.module';
import { Keyword } from '../keywords/entities/keyword.entity';
import { KeywordsModule } from '../keywords/keywords.module';
import { Notification } from '../notifications/entities/notification.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { SlaIncident } from '../sla/entities/sla-incident.entity';
import { SlaModule } from '../sla/sla.module';
import { TeamMember } from '../team-members/entities/team-member.entity';
import { TeamMembersModule } from '../team-members/team-members.module';
import { typeOrmTestConfig } from './typeorm-test.config';

const ALL_ENTITIES = [
  Group,
  GroupMember,
  TeamMember,
  Keyword,
  Issue,
  SlaIncident,
  EodReport,
  Notification,
];

/**
 * Now that Issues/SLA/Notifications are genuinely interdependent
 * (SlaService depends on GroupsService, IssuesService, and
 * NotificationsService), hand-picking individual providers per spec file
 * is brittle — this wires the real feature modules against a real
 * PostgreSQL database, same as the e2e tests, just without an HTTP layer.
 */
export function buildFullTestModule(): TestingModuleBuilder {
  return Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({ isGlobal: true }),
      TypeOrmModule.forRoot(typeOrmTestConfig(ALL_ENTITIES)),
      GroupsModule,
      TeamMembersModule,
      KeywordsModule,
      IssuesModule,
      SlaModule,
      NotificationsModule,
      EodModule,
    ],
  });
}

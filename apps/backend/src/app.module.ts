import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { resolve } from 'path';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DashboardModule } from './dashboard/dashboard.module';
import { DatabaseModule } from './database/database.module';
import { EodModule } from './eod/eod.module';
import { EventsModule } from './events/events.module';
import { GroupsModule } from './groups/groups.module';
import { IssuesModule } from './issues/issues.module';
import { KeywordsModule } from './keywords/keywords.module';
import { NotificationsModule } from './notifications/notifications.module';
import { SlaModule } from './sla/sla.module';
import { TeamMembersModule } from './team-members/team-members.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // npm scripts run with cwd = apps/backend; the repo's single .env
      // lives at the repo root. Earlier entries win, matching data-source.ts.
      envFilePath: [
        resolve(process.cwd(), '.env'),
        resolve(process.cwd(), '../../.env'),
      ],
    }),
    DatabaseModule,
    GroupsModule,
    TeamMembersModule,
    KeywordsModule,
    IssuesModule,
    SlaModule,
    EodModule,
    NotificationsModule,
    DashboardModule,
    EventsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

import { Module } from '@nestjs/common';
import { EodModule } from '../eod/eod.module';
import { GroupsModule } from '../groups/groups.module';
import { IssuesModule } from '../issues/issues.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { SlaModule } from '../sla/sla.module';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';
import { WebhookSecretGuard } from './guards/webhook-secret.guard';

@Module({
  imports: [
    IssuesModule,
    SlaModule,
    EodModule,
    GroupsModule,
    NotificationsModule,
  ],
  controllers: [EventsController],
  providers: [EventsService, WebhookSecretGuard],
})
export class EventsModule {}

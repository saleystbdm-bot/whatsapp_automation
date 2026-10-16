import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GroupsModule } from '../groups/groups.module';
import { WassengerWebhookEvent } from './entities/wassenger-webhook-event.entity';
import { WassengerWebhookAuthGuard } from './guards/wassenger-webhook-auth.guard';
import { N8nForwarderService } from './n8n-forwarder.service';
import { WassengerWebhookController } from './wassenger-webhook.controller';
import { WassengerWebhookService } from './wassenger-webhook.service';

@Module({
  imports: [TypeOrmModule.forFeature([WassengerWebhookEvent]), GroupsModule],
  controllers: [WassengerWebhookController],
  providers: [
    WassengerWebhookService,
    N8nForwarderService,
    WassengerWebhookAuthGuard,
  ],
})
export class WebhooksModule {}

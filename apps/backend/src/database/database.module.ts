import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EodReport } from '../eod/entities/eod-report.entity';
import { GroupMember } from '../groups/entities/group-member.entity';
import { Group } from '../groups/entities/group.entity';
import { Issue } from '../issues/entities/issue.entity';
import { Keyword } from '../keywords/entities/keyword.entity';
import { Notification } from '../notifications/entities/notification.entity';
import { SlaIncident } from '../sla/entities/sla-incident.entity';
import { TeamMember } from '../team-members/entities/team-member.entity';
import { WassengerWebhookEvent } from '../webhooks/entities/wassenger-webhook-event.entity';

/**
 * Schema is owned entirely by migrations (see src/database/migrations and
 * data-source.ts). `synchronize` is unconditionally false — including in
 * development — so the schema an engineer sees locally always matches what
 * `npm run migration:run` actually produces, and never silently drifts
 * from what `data-source.ts` would generate for the CLI.
 */
@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get<string>('DB_HOST', 'localhost'),
        port: config.get<number>('DB_PORT', 5432),
        username: config.get<string>('DB_USERNAME', 'postgres'),
        password: config.get<string>('DB_PASSWORD', 'postgres'),
        database: config.get<string>('DB_NAME', 'whatsapp_operations'),
        entities: [
          Group,
          GroupMember,
          TeamMember,
          Keyword,
          Issue,
          SlaIncident,
          EodReport,
          Notification,
          WassengerWebhookEvent,
        ],
        ssl: config.get<string>('DB_SSL', 'false') === 'true' ? { rejectUnauthorized: true } : false,
        synchronize: false,
      }),
    }),
  ],
})
export class DatabaseModule {}

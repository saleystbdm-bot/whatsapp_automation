import { config as loadEnv } from 'dotenv';
import { resolve } from 'path';
import { DataSource } from 'typeorm';
import { GroupMember } from '../groups/entities/group-member.entity';
import { Group } from '../groups/entities/group.entity';
import { EodReport } from '../eod/entities/eod-report.entity';
import { Issue } from '../issues/entities/issue.entity';
import { Keyword } from '../keywords/entities/keyword.entity';
import { Notification } from '../notifications/entities/notification.entity';
import { SlaIncident } from '../sla/entities/sla-incident.entity';
import { TeamMember } from '../team-members/entities/team-member.entity';

// The `typeorm` CLI (see package.json's "typeorm" script) runs standalone,
// outside Nest's bootstrap, so it doesn't get env vars from ConfigModule.
// npm scripts here run with cwd = apps/backend; the repo's .env lives two
// levels up (apps/backend -> apps -> repo root), so we load both an
// apps/backend/.env (if one is ever added) and the repo-root .env (dotenv
// never overrides a var that's already set, so the former wins).
loadEnv({ path: resolve(process.cwd(), '.env') });
loadEnv({ path: resolve(process.cwd(), '../../.env') });

const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 5432),
  username: process.env.DB_USERNAME ?? 'postgres',
  password: process.env.DB_PASSWORD ?? 'postgres',
  database: process.env.DB_NAME ?? 'whatsapp_operations',
  entities: [
    Group,
    GroupMember,
    TeamMember,
    Keyword,
    Issue,
    SlaIncident,
    EodReport,
    Notification,
  ],
  migrations: [resolve(__dirname, 'migrations/*.{ts,js}')],
  synchronize: false,
});

export default AppDataSource;

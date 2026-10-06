import type { TypeOrmModuleOptions } from '@nestjs/typeorm';
import type { EntityClassOrSchema } from '@nestjs/typeorm/dist/interfaces/entity-class-or-schema.type';

/**
 * These are integration tests, not mocked unit tests: they run against a
 * real PostgreSQL database (the same one docker-compose.yml provisions)
 * with the schema created by the migrations in src/database/migrations —
 * `synchronize` is false here too, deliberately, so the tests exercise the
 * exact constraints the migration creates. Run `npm run migration:run`
 * before `npm test`.
 */
export function typeOrmTestConfig(
  entities: EntityClassOrSchema[],
): TypeOrmModuleOptions {
  return {
    type: 'postgres',
    host: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT ?? 5432),
    username: process.env.DB_USERNAME ?? 'postgres',
    password: process.env.DB_PASSWORD ?? 'postgres',
    database: process.env.DB_NAME ?? 'whatsapp_operations',
    entities,
    synchronize: false,
  };
}

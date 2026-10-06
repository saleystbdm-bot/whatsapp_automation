import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GroupsModule } from '../groups/groups.module';
import { IssuesModule } from '../issues/issues.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { SlaIncident } from './entities/sla-incident.entity';
import { SlaController } from './sla.controller';
import { SlaService } from './sla.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([SlaIncident]),
    GroupsModule,
    IssuesModule,
    NotificationsModule,
  ],
  controllers: [SlaController],
  providers: [SlaService],
  exports: [SlaService, TypeOrmModule],
})
export class SlaModule {}

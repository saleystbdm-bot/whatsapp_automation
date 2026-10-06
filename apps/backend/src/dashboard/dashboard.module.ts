import { Module } from '@nestjs/common';
import { EodModule } from '../eod/eod.module';
import { GroupsModule } from '../groups/groups.module';
import { IssuesModule } from '../issues/issues.module';
import { SlaModule } from '../sla/sla.module';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

/**
 * DashboardService has no repository of its own — it is a pure
 * aggregation layer over Issues/SLA/EOD/Groups, so this module imports
 * only their services, not TypeOrmModule.forFeature for any entity.
 */
@Module({
  imports: [IssuesModule, SlaModule, EodModule, GroupsModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}

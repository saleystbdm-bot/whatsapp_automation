import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, In } from 'typeorm';
import { GroupType } from '../common/enums/group-type.enum';
import { SyncWassengerResponseDto } from './dto/sync-wassenger-response.dto';
import { Group } from './entities/group.entity';
import { WassengerClientService } from './wassenger/wassenger-client.service';

const DEFAULT_TYPE = GroupType.INTERNAL;
const DEFAULT_SLA_MINUTES = 30;

/**
 * Imports WhatsApp groups from Wassenger into `groups`. Deliberately a
 * separate service from GroupsService — this is bulk, external-API-backed
 * synchronization, not the single-group CRUD/business-rule surface
 * GroupsService owns. Matched by `whatsappGroupId` (Wassenger's `wid`,
 * never Wassenger's own internal group id).
 */
@Injectable()
export class GroupsSyncService {
  constructor(
    private readonly wassengerClient: WassengerClientService,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  async syncFromWassenger(): Promise<SyncWassengerResponseDto> {
    const fetched = await this.wassengerClient.fetchAllGroups();

    let created = 0;
    let updated = 0;
    let unchanged = 0;

    // One transaction for the whole batch: either every group in this
    // sync is applied, or (on error) none of it is — never a partially
    // applied import.
    await this.dataSource.transaction(async (manager) => {
      const groups = manager.getRepository(Group);

      const wids = fetched.map((group) => group.wid);
      const existingGroups =
        wids.length > 0
          ? await groups.find({ where: { whatsappGroupId: In(wids) } })
          : [];
      const existingByWid = new Map(
        existingGroups.map((group) => [group.whatsappGroupId, group]),
      );

      const toSave: Group[] = [];
      for (const fetchedGroup of fetched) {
        const existing = existingByWid.get(fetchedGroup.wid);

        if (!existing) {
          // New groups are never auto-monitored — the same rule
          // GroupsService.create() enforces for manually added groups.
          toSave.push(
            groups.create({
              whatsappGroupId: fetchedGroup.wid,
              name: fetchedGroup.name,
              type: DEFAULT_TYPE,
              slaMinutes: DEFAULT_SLA_MINUTES,
              active: false,
            }),
          );
          created++;
          continue;
        }

        if (existing.name !== fetchedGroup.name) {
          // Preserve everything except the name: type, active, slaMinutes,
          // members, keywords, and historical records are untouched.
          existing.name = fetchedGroup.name;
          toSave.push(existing);
          updated++;
        } else {
          unchanged++;
        }
      }

      if (toSave.length > 0) {
        await groups.save(toSave);
      }
    });

    return { totalFetched: fetched.length, created, updated, unchanged };
  }
}

import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { GroupType } from '../common/enums/group-type.enum';
import { Keyword } from '../keywords/entities/keyword.entity';
import { TeamMember } from '../team-members/entities/team-member.entity';
import { uniqueId } from '../test-utils/fixtures';
import { typeOrmTestConfig } from '../test-utils/typeorm-test.config';
import { GroupsSyncService } from './groups-sync.service';
import { Group } from './entities/group.entity';
import { GroupMember } from './entities/group-member.entity';
import type { WassengerGroup } from './wassenger/wassenger-client.service';
import { WassengerClientService } from './wassenger/wassenger-client.service';

describe('GroupsSyncService (integration)', () => {
  let module: TestingModule;
  let dataSource: DataSource;
  let syncService: GroupsSyncService;
  let fetchAllGroups: jest.Mock<Promise<WassengerGroup[]>, []>;
  const createdGroupIds: string[] = [];

  beforeAll(async () => {
    fetchAllGroups = jest.fn<Promise<WassengerGroup[]>, []>();

    module = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot(
          typeOrmTestConfig([Group, GroupMember, TeamMember, Keyword]),
        ),
        TypeOrmModule.forFeature([Group, GroupMember]),
      ],
      providers: [
        GroupsSyncService,
        { provide: WassengerClientService, useValue: { fetchAllGroups } },
      ],
    }).compile();

    syncService = module.get(GroupsSyncService);
    dataSource = module.get(DataSource);
  });

  afterEach(() => {
    fetchAllGroups.mockReset();
  });

  afterAll(async () => {
    if (createdGroupIds.length > 0) {
      await dataSource.query('DELETE FROM groups WHERE id = ANY($1)', [
        createdGroupIds,
      ]);
    }
    await module.close();
  });

  async function trackByWid(wids: string[]): Promise<void> {
    const rows: { id: string }[] = await dataSource.query(
      'SELECT id FROM groups WHERE whatsapp_group_id = ANY($1)',
      [wids],
    );
    createdGroupIds.push(...rows.map((row) => row.id));
  }

  it('creates new groups unmonitored, type INTERNAL, 30-minute SLA', async () => {
    const wid = uniqueId('wa-new');
    fetchAllGroups.mockResolvedValue([{ wid, name: 'Freshly Imported Group' }]);

    const summary = await syncService.syncFromWassenger();
    await trackByWid([wid]);

    expect(summary).toEqual({
      totalFetched: 1,
      created: 1,
      updated: 0,
      unchanged: 0,
    });

    const repo = dataSource.getRepository(Group);
    const saved = await repo.findOneByOrFail({ whatsappGroupId: wid });
    expect(saved.name).toBe('Freshly Imported Group');
    expect(saved.type).toBe(GroupType.INTERNAL);
    expect(saved.slaMinutes).toBe(30);
    expect(saved.active).toBe(false);
  });

  it('updates the name of an existing group but preserves active/type/slaMinutes', async () => {
    const wid = uniqueId('wa-existing');
    const repo = dataSource.getRepository(Group);
    const existing = await repo.save(
      repo.create({
        whatsappGroupId: wid,
        name: 'Old Name',
        type: GroupType.CLIENT,
        slaMinutes: 15,
        active: true,
      }),
    );
    createdGroupIds.push(existing.id);

    fetchAllGroups.mockResolvedValue([
      { wid, name: 'New Name From Wassenger' },
    ]);
    const summary = await syncService.syncFromWassenger();

    expect(summary).toEqual({
      totalFetched: 1,
      created: 0,
      updated: 1,
      unchanged: 0,
    });

    const reloaded = await repo.findOneByOrFail({ id: existing.id });
    expect(reloaded.name).toBe('New Name From Wassenger');
    expect(reloaded.type).toBe(GroupType.CLIENT); // preserved, not reset to INTERNAL
    expect(reloaded.slaMinutes).toBe(15); // preserved, not reset to 30
    expect(reloaded.active).toBe(true); // preserved — a sync must never auto-monitor or un-monitor
  });

  it('counts a group with no change as unchanged and performs no write', async () => {
    const wid = uniqueId('wa-unchanged');
    const repo = dataSource.getRepository(Group);
    const existing = await repo.save(
      repo.create({
        whatsappGroupId: wid,
        name: 'Stable Group',
        type: GroupType.INTERNAL,
        slaMinutes: 30,
        active: false,
      }),
    );
    createdGroupIds.push(existing.id);
    const updatedAtBefore = existing.updatedAt;

    fetchAllGroups.mockResolvedValue([{ wid, name: 'Stable Group' }]);
    const summary = await syncService.syncFromWassenger();

    expect(summary).toEqual({
      totalFetched: 1,
      created: 0,
      updated: 0,
      unchanged: 1,
    });

    const reloaded = await repo.findOneByOrFail({ id: existing.id });
    expect(reloaded.updatedAt).toEqual(updatedAtBefore);
  });

  it('handles a mixed batch (create + update + unchanged) in one call with correct counts', async () => {
    const newWid = uniqueId('wa-mixed-new');
    const updateWid = uniqueId('wa-mixed-update');
    const unchangedWid = uniqueId('wa-mixed-unchanged');
    const repo = dataSource.getRepository(Group);

    const toUpdate = await repo.save(
      repo.create({
        whatsappGroupId: updateWid,
        name: 'Before',
        type: GroupType.INTERNAL,
        slaMinutes: 30,
        active: true,
      }),
    );
    const toLeaveAlone = await repo.save(
      repo.create({
        whatsappGroupId: unchangedWid,
        name: 'Same',
        type: GroupType.CLIENT,
        slaMinutes: 45,
        active: true,
      }),
    );
    createdGroupIds.push(toUpdate.id, toLeaveAlone.id);

    fetchAllGroups.mockResolvedValue([
      { wid: newWid, name: 'Brand New' },
      { wid: updateWid, name: 'After' },
      { wid: unchangedWid, name: 'Same' },
    ]);

    const summary = await syncService.syncFromWassenger();
    await trackByWid([newWid]);

    expect(summary).toEqual({
      totalFetched: 3,
      created: 1,
      updated: 1,
      unchanged: 1,
    });
  });

  it('never creates a duplicate group for a whatsappGroupId that already exists', async () => {
    const wid = uniqueId('wa-no-dupe');
    const repo = dataSource.getRepository(Group);
    const existing = await repo.save(
      repo.create({
        whatsappGroupId: wid,
        name: 'Original',
        type: GroupType.INTERNAL,
        slaMinutes: 30,
        active: false,
      }),
    );
    createdGroupIds.push(existing.id);

    fetchAllGroups.mockResolvedValue([{ wid, name: 'Original Renamed' }]);
    await syncService.syncFromWassenger();

    const rows = await repo.find({ where: { whatsappGroupId: wid } });
    expect(rows).toHaveLength(1);
  });
});

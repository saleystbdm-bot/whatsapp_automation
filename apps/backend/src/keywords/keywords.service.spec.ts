import { ConflictException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { GroupType } from '../common/enums/group-type.enum';
import { createTestGroup } from '../test-utils/fixtures';
import { typeOrmTestConfig } from '../test-utils/typeorm-test.config';
import { GroupMember } from '../groups/entities/group-member.entity';
import { Group } from '../groups/entities/group.entity';
import { TeamMember } from '../team-members/entities/team-member.entity';
import { Keyword } from './entities/keyword.entity';
import { KeywordsService } from './keywords.service';

describe('KeywordsService (integration)', () => {
  let module: TestingModule;
  let keywordsService: KeywordsService;
  let groupId: string;
  const createdGroupIds: string[] = [];

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot(
          typeOrmTestConfig([Keyword, Group, GroupMember, TeamMember]),
        ),
        TypeOrmModule.forFeature([Keyword, Group]),
      ],
      providers: [KeywordsService],
    }).compile();
    keywordsService = module.get(KeywordsService);

    const group = await createTestGroup(module.get(DataSource), {
      name: 'Keyword Test Group',
      type: GroupType.INTERNAL,
    });
    groupId = group.id;
    createdGroupIds.push(group.id);
  });

  afterAll(async () => {
    const dataSource = module.get(DataSource);
    await dataSource.query('DELETE FROM keywords WHERE group_id = ANY($1)', [
      createdGroupIds,
    ]);
    await dataSource.query('DELETE FROM groups WHERE id = ANY($1)', [
      createdGroupIds,
    ]);
    await module.close();
  });

  it('creates a keyword, normalized to lowercase/trimmed', async () => {
    const keyword = await keywordsService.create(groupId, {
      keyword: '  Payment  ',
    });
    expect(keyword.keyword).toBe('payment');
    expect(keyword.active).toBe(true);

    const all = await keywordsService.findAllForGroup(groupId);
    expect(all.map((k) => k.keyword)).toContain('payment');
  });

  it('rejects a duplicate active keyword for the same group with a ConflictException', async () => {
    await keywordsService.create(groupId, { keyword: 'urgent' });

    await expect(
      keywordsService.create(groupId, { keyword: 'urgent' }),
    ).rejects.toThrow(ConflictException);
  });

  it('deactivates a keyword via update({ active: false })', async () => {
    const keyword = await keywordsService.create(groupId, { keyword: 'error' });
    const deactivated = await keywordsService.update(groupId, keyword.id, {
      active: false,
    });
    expect(deactivated.active).toBe(false);
  });

  it('allows re-adding a keyword after the previous one was deactivated', async () => {
    const first = await keywordsService.create(groupId, { keyword: 'failed' });
    await keywordsService.update(groupId, first.id, { active: false });

    const second = await keywordsService.create(groupId, { keyword: 'failed' });
    expect(second.id).not.toBe(first.id);
    expect(second.active).toBe(true);
  });

  it('deletes a keyword', async () => {
    const keyword = await keywordsService.create(groupId, { keyword: 'down' });
    await keywordsService.remove(groupId, keyword.id);

    const all = await keywordsService.findAllForGroup(groupId);
    expect(all.find((k) => k.id === keyword.id)).toBeUndefined();
  });
});

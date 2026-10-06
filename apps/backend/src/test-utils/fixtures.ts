import type { DataSource } from 'typeorm';
import { GroupType } from '../common/enums/group-type.enum';
import { Group } from '../groups/entities/group.entity';

export function uniqueId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
}

export function testPhone(): string {
  return `+91${Math.floor(1_000_000_000 + Math.random() * 8_999_999_999)}`;
}

/**
 * Creates a Group directly via the repository (bypassing GroupsService),
 * for use as a fixture in tests of unrelated modules (Issues, SLA, EOD,
 * Notifications) that just need *some* group to exist and shouldn't be
 * coupled to GroupsService's own dependency graph or business rules
 * (e.g. GroupsService.create() defaults `active` to false — a fixture
 * group here defaults to `active: true` since these tests are about the
 * dependent entity, not about group monitoring state).
 */
export async function createTestGroup(
  dataSource: DataSource,
  overrides: Partial<
    Pick<Group, 'name' | 'type' | 'slaMinutes' | 'active'>
  > = {},
): Promise<Group> {
  const repository = dataSource.getRepository(Group);
  const group = repository.create({
    whatsappGroupId: uniqueId('wa'),
    name: overrides.name ?? 'Test Group',
    type: overrides.type ?? GroupType.INTERNAL,
    slaMinutes: overrides.slaMinutes ?? 30,
    active: overrides.active ?? true,
  });
  return repository.save(group);
}

import { ConflictException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource, QueryFailedError } from 'typeorm';
import { testPhone } from '../test-utils/fixtures';
import { typeOrmTestConfig } from '../test-utils/typeorm-test.config';
import { TeamMember } from './entities/team-member.entity';
import { TeamMembersService } from './team-members.service';

describe('TeamMembersService (integration)', () => {
  let module: TestingModule;
  let service: TeamMembersService;
  const createdIds: string[] = [];

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot(typeOrmTestConfig([TeamMember])),
        TypeOrmModule.forFeature([TeamMember]),
      ],
      providers: [TeamMembersService],
    }).compile();
    service = module.get(TeamMembersService);
  });

  afterAll(async () => {
    const dataSource = module.get(DataSource);
    if (createdIds.length > 0) {
      await dataSource.query('DELETE FROM team_members WHERE id = ANY($1)', [
        createdIds,
      ]);
    }
    await module.close();
  });

  it('creates a team member', async () => {
    const phone = testPhone();
    const member = await service.create({
      name: 'Harish',
      phone,
      role: 'Engineer',
    });
    createdIds.push(member.id);

    expect(member.id).toBeDefined();
    expect(member.phone).toBe(phone);
    expect(member.active).toBe(true);

    const found = await service.findByPhone(phone);
    expect(found?.id).toBe(member.id);
  });

  it('rejects a duplicate phone number with a ConflictException', async () => {
    const phone = testPhone();
    const first = await service.create({ name: 'Aakash', phone });
    createdIds.push(first.id);

    await expect(
      service.create({ name: 'Someone Else', phone }),
    ).rejects.toThrow(ConflictException);
  });

  it('rejects a phone number that is not E.164', async () => {
    // missing leading '+', so it violates the DB check constraint
    await expect(
      service.create({ name: 'Bad Phone', phone: '919566831192' }),
    ).rejects.toThrow(QueryFailedError);
  });
});

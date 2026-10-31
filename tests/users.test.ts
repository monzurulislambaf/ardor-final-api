import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { UserModel } from '../src/modules/users/users.model';
import { api, app, bearer, createSession, registerUser, strongPassword, uniqueEmail, type TestSession } from './helpers';

let admin: TestSession;
let manager: TestSession;
let regular: TestSession;

beforeAll(async () => {
  admin = await createSession('admin');
  manager = await createSession('manager');
  regular = await createSession('user');
});

describe('role-based authorization', () => {
  it('requires authentication', async () => {
    const res = await request(app).get(api('/users'));
    expect(res.status).toBe(401);
  });

  it('forbids regular users from listing or creating users', async () => {
    const list = await request(app).get(api('/users')).set(bearer(regular.accessToken));
    const create = await request(app)
      .post(api('/users'))
      .set(bearer(regular.accessToken))
      .send({ name: 'Nope', email: uniqueEmail(), password: strongPassword, role: 'admin' });

    expect(list.status).toBe(403);
    expect(create.status).toBe(403);
  });

  it('lets managers read but not modify users', async () => {
    const list = await request(app).get(api('/users')).set(bearer(manager.accessToken));
    const remove = await request(app).delete(api(`/users/${regular.id}`)).set(bearer(manager.accessToken));

    expect(list.status).toBe(200);
    expect(remove.status).toBe(403);
  });
});

describe('admin user management', () => {
  it('creates a user with an explicit role', async () => {
    const email = uniqueEmail('staff');
    const res = await request(app)
      .post(api('/users'))
      .set(bearer(admin.accessToken))
      .send({ name: 'Front Desk', email, password: strongPassword, role: 'staff' });

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ email, role: 'staff', status: 'active' });
    expect(JSON.stringify(res.body)).not.toContain('password');
  });

  it('lists users with pagination, filtering, search and sorting', async () => {
    await Promise.all(
      ['Alpha', 'Bravo', 'Charlie'].map((name) =>
        request(app)
          .post(api('/users'))
          .set(bearer(admin.accessToken))
          .send({ name: `${name} Listed`, email: uniqueEmail(name.toLowerCase()), password: strongPassword, role: 'staff' }),
      ),
    );

    const page = await request(app)
      .get(api('/users'))
      .query({ role: 'staff', search: 'listed', sort: 'name', limit: 2, page: 1 })
      .set(bearer(admin.accessToken));

    expect(page.status).toBe(200);
    expect(page.body.data.map((u: { name: string }) => u.name)).toEqual(['Alpha Listed', 'Bravo Listed']);
    expect(page.body.meta.pagination).toMatchObject({
      page: 1,
      limit: 2,
      total: 3,
      totalPages: 2,
      hasNextPage: true,
      hasPrevPage: false,
    });

    const desc = await request(app)
      .get(api('/users'))
      .query({ role: 'staff', search: 'listed', sort: '-name', limit: 1 })
      .set(bearer(admin.accessToken));
    expect(desc.body.data[0].name).toBe('Charlie Listed');
  });

  it('validates query parameters', async () => {
    const res = await request(app).get(api('/users')).query({ limit: 1000, role: 'wizard' }).set(bearer(admin.accessToken));

    expect(res.status).toBe(400);
    expect(res.body.errors.map((e: { field: string }) => e.field)).toEqual(
      expect.arrayContaining(['query.limit', 'query.role']),
    );
  });

  it('does not let clients sort by private fields', async () => {
    const res = await request(app).get(api('/users')).query({ sort: 'password' }).set(bearer(admin.accessToken));
    expect(res.status).toBe(200);
  });

  it('gets, updates and deletes a user', async () => {
    const { res: created } = await registerUser();
    const id = created.body.data.user.id;

    const got = await request(app).get(api(`/users/${id}`)).set(bearer(admin.accessToken));
    expect(got.status).toBe(200);

    const updated = await request(app)
      .patch(api(`/users/${id}`))
      .set(bearer(admin.accessToken))
      .send({ role: 'manager', status: 'inactive' });
    expect(updated.status).toBe(200);
    expect(updated.body.data).toMatchObject({ role: 'manager', status: 'inactive' });

    const removed = await request(app).delete(api(`/users/${id}`)).set(bearer(admin.accessToken));
    expect(removed.status).toBe(200);

    const gone = await request(app).get(api(`/users/${id}`)).set(bearer(admin.accessToken));
    expect(gone.status).toBe(404);
  });

  it('returns 400 for malformed ids and 404 for unknown ones', async () => {
    const bad = await request(app).get(api('/users/not-an-id')).set(bearer(admin.accessToken));
    const missing = await request(app).get(api('/users/665f1c2e8f1b2a0012a4b3c4')).set(bearer(admin.accessToken));

    expect(bad.status).toBe(400);
    expect(missing.status).toBe(404);
  });

  it('prevents admins from changing or deleting themselves', async () => {
    const demote = await request(app)
      .patch(api(`/users/${admin.id}`))
      .set(bearer(admin.accessToken))
      .send({ role: 'user' });
    const remove = await request(app).delete(api(`/users/${admin.id}`)).set(bearer(admin.accessToken));

    expect(demote.status).toBe(403);
    expect(remove.status).toBe(403);
  });

  it('locks out a user whose status is changed to suspended', async () => {
    const victim = await createSession();
    await request(app)
      .patch(api(`/users/${victim.id}`))
      .set(bearer(admin.accessToken))
      .send({ status: 'suspended' })
      .expect(200);

    const res = await request(app).get(api('/auth/me')).set(bearer(victim.accessToken));
    expect(res.status).toBe(403);
  });
});

describe('own profile', () => {
  it('reads and updates the profile but cannot escalate privileges', async () => {
    const session = await createSession();

    const read = await request(app).get(api('/users/me')).set(bearer(session.accessToken));
    expect(read.status).toBe(200);
    expect(read.body.data.email).toBe(session.email);

    const update = await request(app)
      .patch(api('/users/me'))
      .set(bearer(session.accessToken))
      .send({ name: 'New Name', role: 'admin' });
    expect(update.status).toBe(200);
    expect(update.body.data).toMatchObject({ name: 'New Name', role: 'user' });

    const stored = await UserModel.findById(session.id);
    expect(stored?.role).toBe('user');
  });

  it('rejects an empty update', async () => {
    const session = await createSession();
    const res = await request(app).patch(api('/users/me')).set(bearer(session.accessToken)).send({});
    expect(res.status).toBe(400);
  });
});

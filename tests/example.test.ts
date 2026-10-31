import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { api, app, bearer, createSession, type TestSession } from './helpers';

let alice: TestSession;
let bob: TestSession;
let admin: TestSession;

const create = (session: TestSession, body: Record<string, unknown>) =>
  request(app).post(api('/examples')).set(bearer(session.accessToken)).send(body);

beforeAll(async () => {
  [alice, bob, admin] = await Promise.all([createSession(), createSession(), createSession('admin')]);
});

describe('example CRUD', () => {
  it('requires authentication', async () => {
    const res = await request(app).get(api('/examples'));
    expect(res.status).toBe(401);
  });

  it('creates a record owned by the caller with defaults applied', async () => {
    const res = await create(alice, { title: 'First item', tags: ['Work', 'work', 'Urgent'] });

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      title: 'First item',
      status: 'draft',
      priority: 'medium',
      owner: alice.id,
      tags: ['work', 'urgent'],
    });
    expect(res.body.data.id).toEqual(expect.any(String));
    expect(res.body.data._id).toBeUndefined();
    expect(res.body.data.__v).toBeUndefined();
  });

  it('ignores a client-supplied owner', async () => {
    const res = await create(alice, { title: 'Owner spoof', owner: bob.id });
    expect(res.status).toBe(201);
    expect(res.body.data.owner).toBe(alice.id);
  });

  it('validates the body', async () => {
    const res = await create(alice, { title: 'x', status: 'bogus', tags: Array(11).fill('t') });

    expect(res.status).toBe(400);
    expect(res.body.errors.map((e: { field: string }) => e.field)).toEqual(
      expect.arrayContaining(['body.title', 'body.status', 'body.tags']),
    );
  });

  it('reads, updates and deletes a record', async () => {
    const { body } = await create(alice, { title: 'Lifecycle' });
    const id = body.data.id;
    const auth = bearer(alice.accessToken);

    const read = await request(app).get(api(`/examples/${id}`)).set(auth);
    expect(read.status).toBe(200);

    const update = await request(app).patch(api(`/examples/${id}`)).set(auth).send({ status: 'active', priority: 'high' });
    expect(update.status).toBe(200);
    expect(update.body.data).toMatchObject({ title: 'Lifecycle', status: 'active', priority: 'high' });

    const remove = await request(app).delete(api(`/examples/${id}`)).set(auth);
    expect(remove.status).toBe(200);
    expect(remove.body).toMatchObject({ success: true, data: null });

    const gone = await request(app).get(api(`/examples/${id}`)).set(auth);
    expect(gone.status).toBe(404);
  });

  it('rejects empty updates and malformed ids', async () => {
    const { body } = await create(alice, { title: 'Validation target' });
    const auth = bearer(alice.accessToken);

    const empty = await request(app).patch(api(`/examples/${body.data.id}`)).set(auth).send({});
    const badId = await request(app).get(api('/examples/123')).set(auth);

    expect(empty.status).toBe(400);
    expect(badId.status).toBe(400);
  });
});

describe('ownership', () => {
  it('hides other users records (404) for read, update and delete', async () => {
    const { body } = await create(alice, { title: 'Private to alice' });
    const id = body.data.id;
    const auth = bearer(bob.accessToken);

    expect((await request(app).get(api(`/examples/${id}`)).set(auth)).status).toBe(404);
    expect((await request(app).patch(api(`/examples/${id}`)).set(auth).send({ title: 'Hijack' })).status).toBe(404);
    expect((await request(app).delete(api(`/examples/${id}`)).set(auth)).status).toBe(404);

    const stillThere = await request(app).get(api(`/examples/${id}`)).set(bearer(alice.accessToken));
    expect(stillThere.body.data.title).toBe('Private to alice');
  });

  it('lets admins see and manage everything', async () => {
    const { body } = await create(bob, { title: 'Bob record for admin' });
    const id = body.data.id;

    const read = await request(app).get(api(`/examples/${id}`)).set(bearer(admin.accessToken));
    const update = await request(app)
      .patch(api(`/examples/${id}`))
      .set(bearer(admin.accessToken))
      .send({ status: 'archived' });

    expect(read.status).toBe(200);
    expect(update.body.data.status).toBe('archived');
  });
});

describe('listing', () => {
  let carol: TestSession;

  beforeAll(async () => {
    carol = await createSession();
    const items = [
      { title: 'Buy groceries', priority: 'low', status: 'active', tags: ['home'] },
      { title: 'Write report', priority: 'high', status: 'active', tags: ['work'] },
      { title: 'Plan holiday', priority: 'medium', status: 'draft', tags: ['home', 'fun'] },
      { title: 'Review report draft', priority: 'high', status: 'archived', tags: ['work'] },
    ];
    for (const item of items) await create(carol, item).expect(201);
  });

  const list = (query: Record<string, string | number>) =>
    request(app).get(api('/examples')).query(query).set(bearer(carol.accessToken));

  it('only returns the caller own records with pagination metadata', async () => {
    const res = await list({});

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(4);
    expect(res.body.data.every((item: { owner: string }) => item.owner === carol.id)).toBe(true);
    expect(res.body.meta.pagination).toMatchObject({ page: 1, limit: 20, total: 4, totalPages: 1 });
  });

  it('paginates', async () => {
    const page2 = await list({ limit: 3, page: 2 });

    expect(page2.body.data).toHaveLength(1);
    expect(page2.body.meta.pagination).toMatchObject({ page: 2, total: 4, totalPages: 2, hasNextPage: false, hasPrevPage: true });
  });

  it('filters by status, priority and tag', async () => {
    expect((await list({ status: 'active' })).body.data).toHaveLength(2);
    expect((await list({ priority: 'high' })).body.data).toHaveLength(2);
    expect((await list({ tag: 'home' })).body.data).toHaveLength(2);
    expect((await list({ status: 'active', priority: 'high' })).body.data).toHaveLength(1);
  });

  it('searches titles case-insensitively and treats regex characters literally', async () => {
    const found = await list({ search: 'REPORT' });
    expect(found.body.data.map((i: { title: string }) => i.title).sort()).toEqual(['Review report draft', 'Write report']);

    const literal = await list({ search: '.*' });
    expect(literal.body.data).toHaveLength(0);
  });

  it('sorts ascending and descending', async () => {
    const asc = await list({ sort: 'title' });
    const desc = await list({ sort: '-title' });
    const titles = asc.body.data.map((i: { title: string }) => i.title);

    expect(titles).toEqual([...titles].sort());
    expect(desc.body.data.map((i: { title: string }) => i.title)).toEqual([...titles].reverse());
  });

  it('rejects invalid query values', async () => {
    const res = await list({ page: 0, limit: 500, status: 'nope' });
    expect(res.status).toBe(400);
  });
});

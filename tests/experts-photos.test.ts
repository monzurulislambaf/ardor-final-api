import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { PUBLIC_MEDIA_DIR } from '../src/modules/experts/experts.photos';
import { api, app, bearer, createSession, type TestSession } from './helpers';

// Smallest valid 1x1 PNG.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

const PHOTO_DIR = path.join(PUBLIC_MEDIA_DIR, 'experts');
const diskPath = (url: string) => path.join(PHOTO_DIR, url.replace('/media/experts/', ''));
const exists = (filePath: string) =>
  fs.access(filePath).then(
    () => true,
    () => false,
  );

let admin: TestSession;
let user: TestSession;

beforeAll(async () => {
  [admin, user] = await Promise.all([createSession('admin'), createSession()]);
});

const uploadPhoto = (session: TestSession, buffer: Buffer, filename: string) =>
  request(app).post(api('/experts/photo')).set(bearer(session.accessToken)).attach('photo', buffer, filename);

describe('expert photo upload', () => {
  it('is admin only', async () => {
    expect((await request(app).post(api('/experts/photo')).attach('photo', PNG, 'a.png')).status).toBe(401);
    expect((await uploadPhoto(user, PNG, 'a.png')).status).toBe(403);
  });

  it('rejects files that are not images, whatever their name', async () => {
    const res = await uploadPhoto(admin, Buffer.from('not really an image'), 'fake.jpg');
    expect(res.status).toBe(415);
  });

  it('saves the photo in the uploads folder and serves it publicly from there', async () => {
    const res = await uploadPhoto(admin, PNG, 'portrait.png');
    expect(res.status).toBe(201);
    const url: string = res.body.data.url;
    expect(url).toMatch(/^\/media\/experts\/[0-9a-f-]{36}\.png$/);
    expect(await exists(diskPath(url))).toBe(true);

    const image = await request(app).get(url).set('Origin', 'https://ardorpsychology.com');
    expect(image.status).toBe(200);
    expect(image.headers['content-type']).toBe('image/png');
    // Must be embeddable from the website, which is on another origin.
    expect(image.headers['cross-origin-resource-policy']).toBe('cross-origin');
    expect(Buffer.compare(image.body as Buffer, PNG)).toBe(0);
  });

  it('deletes the file when the expert is deleted', async () => {
    const { body } = await uploadPhoto(admin, PNG, 'portrait.png');
    const url: string = body.data.url;

    const created = await request(app)
      .post(api('/experts'))
      .set(bearer(admin.accessToken))
      .send({
        name: 'Photo Test',
        slug: `photo-test-${Date.now()}`,
        category: 'psychologist',
        title: 'Clinical Psychologist',
        initials: 'PT',
        shortBio: 'A short biography for testing.',
        location: 'London',
        image: url,
      });
    expect(created.status).toBe(201);

    const removed = await request(app).delete(api(`/experts/${created.body.data.id}`)).set(bearer(admin.accessToken));
    expect(removed.status).toBe(200);
    expect(await exists(diskPath(url))).toBe(false);
    expect((await request(app).get(url)).status).toBe(404);
  });

  it('returns 404 for unknown photos and never leaves the media folder', async () => {
    expect((await request(app).get(`/media/experts/${randomUUID()}.jpg`)).status).toBe(404);
    expect((await request(app).get('/media/..%2F..%2F.env')).status).toBe(404);
  });
});

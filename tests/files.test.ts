import fs from 'node:fs/promises';
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { env } from '../src/config/env';
import { FileModel } from '../src/modules/files/files.model';
import { resolveStoredPath } from '../src/modules/files/files.service';
import { api, app, bearer, createSession, type TestSession } from './helpers';

// Smallest valid 1x1 PNG.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);
const PDF = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n');
const EXE = Buffer.concat([Buffer.from('MZ'), Buffer.alloc(200, 1)]);

let alice: TestSession;
let bob: TestSession;
let admin: TestSession;

beforeAll(async () => {
  [alice, bob, admin] = await Promise.all([createSession(), createSession(), createSession('admin')]);
});

const uploadImage = (session: TestSession, buffer: Buffer, filename: string) =>
  request(app).post(api('/files/images')).set(bearer(session.accessToken)).attach('images', buffer, filename);

const uploadFile = (session: TestSession, buffer: Buffer, filename: string) =>
  request(app).post(api('/files')).set(bearer(session.accessToken)).attach('files', buffer, filename);

const exists = (filePath: string) =>
  fs.access(filePath).then(
    () => true,
    () => false,
  );

describe('image upload', () => {
  it('requires authentication', async () => {
    const res = await request(app).post(api('/files/images')).attach('images', PNG, 'a.png');
    expect(res.status).toBe(401);
  });

  it('stores a valid image and reports the detected type', async () => {
    const res = await uploadImage(alice, PNG, 'avatar.png');

    expect(res.status).toBe(201);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0]).toMatchObject({
      originalName: 'avatar.png',
      mimeType: 'image/png',
      extension: 'png',
      kind: 'image',
      size: PNG.length,
      owner: alice.id,
    });
    expect(res.body.data[0].storedName).toBeUndefined();

    const stored = await FileModel.findById(res.body.data[0].id);
    expect(stored?.storedName).toMatch(/^[0-9a-f-]{36}\.png$/);
    expect(await exists(resolveStoredPath(stored!.storedName))).toBe(true);
  });

  it('trusts the content, not the file name', async () => {
    const asPng = await uploadImage(alice, Buffer.from('<script>alert(1)</script>'), 'evil.png');
    const exe = await uploadImage(alice, EXE, 'program.png');
    const pdfAsImage = await uploadImage(alice, PDF, 'doc.png');

    expect(asPng.status).toBe(415);
    expect(exe.status).toBe(415);
    expect(pdfAsImage.status).toBe(415);
    expect(asPng.body).toMatchObject({ success: false });
  });

  it('renames a mislabelled image to its real extension', async () => {
    const res = await uploadImage(alice, PNG, 'photo.jpg');
    const stored = await FileModel.findById(res.body.data[0].id);

    expect(res.status).toBe(201);
    expect(res.body.data[0].mimeType).toBe('image/png');
    expect(stored?.storedName.endsWith('.png')).toBe(true);
  });

  it('accepts several images at once and rejects the whole batch if one is bad', async () => {
    const good = await request(app)
      .post(api('/files/images'))
      .set(bearer(alice.accessToken))
      .attach('images', PNG, 'one.png')
      .attach('images', PNG, 'two.png');
    expect(good.status).toBe(201);
    expect(good.body.data).toHaveLength(2);

    const before = await FileModel.countDocuments({ owner: alice.id });
    const mixed = await request(app)
      .post(api('/files/images'))
      .set(bearer(alice.accessToken))
      .attach('images', PNG, 'ok.png')
      .attach('images', EXE, 'bad.png');
    expect(mixed.status).toBe(415);
    expect(await FileModel.countDocuments({ owner: alice.id })).toBe(before);
  });

  it('rejects requests with no files or the wrong field name', async () => {
    const none = await request(app).post(api('/files/images')).set(bearer(alice.accessToken));
    const wrongField = await request(app)
      .post(api('/files/images'))
      .set(bearer(alice.accessToken))
      .attach('avatar', PNG, 'a.png');

    expect(none.status).toBe(400);
    expect(wrongField.status).toBe(400);
    expect(wrongField.body.message).toContain('Unexpected file field');
  });

  it('rejects empty files', async () => {
    const res = await uploadImage(alice, Buffer.alloc(0), 'empty.png');
    expect(res.status).toBe(400);
  });

  it('enforces the size limit (413)', async () => {
    const big = Buffer.concat([PNG, Buffer.alloc(1.5 * 1024 * 1024)]);
    const res = await uploadImage(alice, big, 'big.png');

    expect(res.status).toBe(413);
    expect(res.body.message).toContain('too large');
  });
});

describe('file upload', () => {
  it('accepts a PDF', async () => {
    const res = await uploadFile(alice, PDF, 'report.pdf');

    expect(res.status).toBe(201);
    expect(res.body.data[0]).toMatchObject({ mimeType: 'application/pdf', kind: 'document', extension: 'pdf' });
  });

  it('accepts text and CSV files but not binary data pretending to be text', async () => {
    const txt = await uploadFile(alice, Buffer.from('hello world\n'), 'notes.txt');
    const csv = await uploadFile(alice, Buffer.from('id,name\n1,Ünïcode\n'), 'people.csv');
    const fake = await uploadFile(alice, Buffer.from([0x00, 0x01, 0x02, 0x03, 0xff]), 'fake.txt');

    expect(txt.status).toBe(201);
    expect(txt.body.data[0].mimeType).toBe('text/plain');
    expect(csv.status).toBe(201);
    expect(csv.body.data[0].mimeType).toBe('text/csv');
    expect(fake.status).toBe(415);
  });

  it('rejects executables, HTML and SVG', async () => {
    const exe = await uploadFile(alice, EXE, 'setup.exe');
    const html = await uploadFile(alice, Buffer.from('<html><script>1</script></html>'), 'page.html');
    const svg = await uploadFile(alice, Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>'), 'logo.svg');

    expect(exe.status).toBe(415);
    expect(html.status).toBe(415);
    expect(svg.status).toBe(415);
  });

  it('enforces the maximum number of files per request', async () => {
    let req = request(app).post(api('/files')).set(bearer(alice.accessToken));
    for (let i = 0; i < 5; i++) req = req.attach('files', PDF, `f${i}.pdf`);
    const res = await req;

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('Too many files');
  });

  it('sanitises file names and keeps path tricks out of the storage path', async () => {
    const res = await uploadFile(alice, PDF, '../../etc/passwd.pdf');
    const windows = await uploadFile(alice, PDF, '..\\..\\windows\\system32\\evil.pdf');
    const stored = await FileModel.findById(res.body.data[0].id);

    expect(res.status).toBe(201);
    expect(res.body.data[0].originalName).toBe('passwd.pdf');
    expect(windows.body.data[0].originalName).toBe('evil.pdf');
    expect(stored?.storedName).toMatch(/^[0-9a-f-]{36}\.pdf$/);
  });

  it('preserves non-ASCII file names', async () => {
    const res = await uploadFile(alice, PDF, 'résumé-日本語.pdf');
    expect(res.status).toBe(201);
    expect(res.body.data[0].originalName).toBe('résumé-日本語.pdf');
  });

  it('leaves no temporary files behind after rejections', async () => {
    await uploadFile(alice, EXE, 'x.exe');
    const leftovers = await fs.readdir(`${env.uploadDir}/.tmp`);
    expect(leftovers).toEqual([]);
  });
});

describe('listing, download and deletion', () => {
  let imageId: string;
  let pdfId: string;

  beforeAll(async () => {
    const carol = await createSession();
    const image = await uploadImage(carol, PNG, 'holiday-photo.png');
    const pdf = await uploadFile(carol, PDF, 'contract.pdf');
    imageId = image.body.data[0].id;
    pdfId = pdf.body.data[0].id;
    alice = carol; // the tests below act as the owner
  });

  it('lists only my files with filtering and search', async () => {
    const all = await request(app).get(api('/files')).set(bearer(alice.accessToken));
    const images = await request(app).get(api('/files')).query({ kind: 'image' }).set(bearer(alice.accessToken));
    const search = await request(app).get(api('/files')).query({ search: 'CONTRACT' }).set(bearer(alice.accessToken));

    expect(all.body.data).toHaveLength(2);
    expect(all.body.meta.pagination.total).toBe(2);
    expect(images.body.data.map((f: { id: string }) => f.id)).toEqual([imageId]);
    expect(search.body.data.map((f: { id: string }) => f.id)).toEqual([pdfId]);
    expect(JSON.stringify(all.body)).not.toContain('storedName');
  });

  it('downloads the exact bytes as an attachment with the original name', async () => {
    const res = await request(app)
      .get(api(`/files/${pdfId}/download`))
      .set(bearer(alice.accessToken))
      .responseType('blob');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application/pdf');
    expect(res.headers['content-disposition']).toMatch(/^attachment; filename="?contract\.pdf"?$/);
    expect(Buffer.compare(res.body, PDF)).toBe(0);
  });

  it('views images inline but refuses to render other kinds', async () => {
    const view = await request(app)
      .get(api(`/files/${imageId}/view`))
      .set(bearer(alice.accessToken))
      .responseType('blob');
    const pdfView = await request(app).get(api(`/files/${pdfId}/view`)).set(bearer(alice.accessToken));

    expect(view.status).toBe(200);
    expect(view.headers['content-type']).toContain('image/png');
    expect(view.headers['content-disposition']).toBe('inline');
    expect(view.headers['x-content-type-options']).toBe('nosniff');
    expect(Buffer.compare(view.body, PNG)).toBe(0);
    expect(pdfView.status).toBe(400);
  });

  it('requires authentication to download', async () => {
    const res = await request(app).get(api(`/files/${pdfId}/download`));
    expect(res.status).toBe(401);
  });

  it("hides other users' files, but lets admins reach them", async () => {
    const asBob = bearer(bob.accessToken);
    expect((await request(app).get(api(`/files/${pdfId}`)).set(asBob)).status).toBe(404);
    expect((await request(app).get(api(`/files/${pdfId}/download`)).set(asBob)).status).toBe(404);
    expect((await request(app).delete(api(`/files/${pdfId}`)).set(asBob)).status).toBe(404);

    const bobList = await request(app).get(api('/files')).set(asBob);
    expect(bobList.body.data.some((f: { id: string }) => f.id === pdfId)).toBe(false);

    const asAdmin = await request(app).get(api(`/files/${pdfId}/download`)).set(bearer(admin.accessToken));
    expect(asAdmin.status).toBe(200);
  });

  it('validates ids', async () => {
    const res = await request(app).get(api('/files/not-an-id/download')).set(bearer(alice.accessToken));
    expect(res.status).toBe(400);
  });

  it('deletes the record and the file on disk', async () => {
    const stored = await FileModel.findById(pdfId);
    const diskPath = resolveStoredPath(stored!.storedName);
    expect(await exists(diskPath)).toBe(true);

    const res = await request(app).delete(api(`/files/${pdfId}`)).set(bearer(alice.accessToken));
    expect(res.status).toBe(200);
    expect(await exists(diskPath)).toBe(false);

    const after = await request(app).get(api(`/files/${pdfId}/download`)).set(bearer(alice.accessToken));
    expect(after.status).toBe(404);
  });

  it('reports 404 when the content is missing from disk', async () => {
    const stored = await FileModel.findById(imageId);
    await fs.rm(resolveStoredPath(stored!.storedName));

    const res = await request(app).get(api(`/files/${imageId}/download`)).set(bearer(alice.accessToken));
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
});

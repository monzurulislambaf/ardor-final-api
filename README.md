# MERN REST API Starter

A production-minded REST API foundation for MERN projects (CRM, hospital or salon management, appointment booking, SaaS back ends…).
**Express 5 · TypeScript (strict) · MongoDB + Mongoose · Zod**, with JWT auth (refresh-token rotation + reuse detection), role-based access control, Swagger docs and an integration-test suite.

## Quick start

```bash
npm install
cp .env.example .env        # Windows PowerShell: Copy-Item .env.example .env
# edit .env: set MONGODB_URI and two different JWT secrets (32+ chars)
npm run dev
```

- API: `http://localhost:5000/api/v1`
- Health check: `http://localhost:5000/api/v1/health`
- Swagger UI: `http://localhost:5000/api/v1/docs` (raw spec: `/api/v1/docs/openapi.json`)

Requirements: Node.js >= 20.11 and a MongoDB instance (local, Docker, or Atlas). Generate strong secrets with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

If any environment variable is missing or invalid the server prints exactly what is wrong and exits.

### Create the first admin

Public registration always creates a regular `user`. Create (or promote) an admin from the CLI:

```bash
npm run create-admin -- admin@example.com 'StrongPass123' 'Admin Name'
```

## Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Start with `tsx watch` (auto-reload) and pretty logs |
| `npm run build` | Remove `dist/` and compile TypeScript |
| `npm start` | Run the compiled app: `node dist/server.js` |
| `npm run typecheck` | Type-check source **and** tests without emitting |
| `npm run clean` | Delete `dist/` |
| `npm test` | Run the Vitest + Supertest suite |
| `npm run test:watch` | Tests in watch mode |
| `npm run create-admin -- <email> <password> [name]` | Create/promote an admin (`create-admin:prod` runs the compiled script) |

## Environment variables

Validated with Zod in [`src/config/env.ts`](src/config/env.ts). `.env` is git-ignored; commit only `.env.example`.

| Variable | Default | Description |
| --- | --- | --- |
| `NODE_ENV` | `development` | `development` \| `production` \| `test` |
| `PORT` | `5000` | HTTP port |
| `API_PREFIX` | `/api/v1` | Prefix for every route |
| `MONGODB_URI` | — (required) | MongoDB connection string |
| `JWT_ACCESS_SECRET` | — (required) | >= 32 chars, must differ from the refresh secret |
| `JWT_REFRESH_SECRET` | — (required) | >= 32 chars |
| `JWT_ACCESS_EXPIRES_IN` | `15m` | `<number><s\|m\|h\|d>` |
| `JWT_REFRESH_EXPIRES_IN` | `7d` | `<number><s\|m\|h\|d>` |
| `CLIENT_ORIGIN` | `http://localhost:3000` | Comma-separated allowed CORS origins; the first is used in password-reset links |
| `LOG_LEVEL` | `info` | `fatal` … `trace`, `silent` |
| `BCRYPT_ROUNDS` | `12` | bcrypt cost |
| `BODY_LIMIT` | `100kb` | Max JSON/urlencoded body size |
| `RATE_LIMIT_WINDOW_MS` / `RATE_LIMIT_MAX` | 15 min / `300` | Global per-IP limit |
| `AUTH_RATE_LIMIT_MAX` | `20` | Per-IP limit for login/register/refresh/password endpoints |
| `PASSWORD_RESET_EXPIRES_MINUTES` | `30` | Reset-token lifetime |
| `COOKIE_SAME_SITE` / `COOKIE_DOMAIN` | `lax` / — | Refresh-cookie policy. Use `none` only for cross-site SPAs (forces `Secure`) |
| `UPLOAD_DIR` | `uploads` | Where uploaded files are stored (git-ignored) |
| `MAX_UPLOAD_SIZE_MB` / `MAX_UPLOAD_FILES` | `5` / `10` | Per-file size limit and files per request |
| `TRUST_PROXY` | `0` | Number of reverse proxies in front of the app (needed for correct IPs and rate limiting) |
| `DOCS_ENABLED` | `true` except in production | Serve Swagger UI |

## Project structure

```
src/
├── config/
│   ├── env.ts                 # Zod-validated environment
│   └── database.ts            # Mongoose connection, events, disconnect
├── modules/
│   ├── auth/                  # register, login, refresh, logout, passwords
│   │   ├── auth.model.ts        # RefreshToken (hashed, TTL index)
│   │   ├── auth.schema.ts       # Zod schemas
│   │   ├── auth.service.ts      # all auth business logic
│   │   ├── auth.controller.ts   # thin HTTP layer + cookies
│   │   ├── auth.routes.ts
│   │   ├── auth.mailer.ts       # password-reset email hook (see below)
│   │   └── auth.docs.ts         # OpenAPI paths
│   ├── users/                 # profile + admin user management
│   ├── files/                 # image/file upload, download, delete
│   └── example/               # fully working CRUD module to copy
├── middlewares/
│   ├── auth.middleware.ts       # authenticate, authorize(...roles)
│   ├── validate.middleware.ts   # Zod body/query/params validation
│   ├── rate-limit.middleware.ts
│   ├── upload.middleware.ts     # multer config + error mapping
│   ├── error.middleware.ts      # one place that formats errors
│   └── not-found.middleware.ts
├── utils/                     # app-error, async-handler, api-response, logger,
│                              # jwt, pagination, object-id, mongoose helpers
├── docs/                      # OpenAPI builder + Swagger UI router
├── types/express.d.ts         # req.user typing
├── scripts/create-admin.ts
├── routes.ts                  # route registry + /health
├── app.ts                     # createApp() — no side effects, used by tests
└── server.ts                  # connect DB, listen, graceful shutdown
tests/                         # Vitest + Supertest (in-memory MongoDB)
```

Layering: `routes → middlewares → controller → service → model`. Controllers never touch the database; services hold the logic. The conventions are written down in [`AGENTS.md`](AGENTS.md).

## API overview

All routes are under `/api/v1`. Responses always use the same envelope:

```jsonc
// success
{ "success": true, "message": "Operation successful", "data": { } }
// paginated success
{ "success": true, "message": "...", "data": [ ], "meta": { "pagination": { "page": 1, "limit": 20, "total": 42, "totalPages": 3, "hasNextPage": true, "hasPrevPage": false } } }
// error
{ "success": false, "message": "Validation failed", "errors": [ { "field": "body.email", "message": "Invalid email address" } ] }
```

| Method & path | Access | Purpose |
| --- | --- | --- |
| `GET /health` | public | Liveness/readiness (503 if DB is down) |
| `POST /auth/register` | public | Create account, start session |
| `POST /auth/login` | public | Log in |
| `POST /auth/refresh` | refresh cookie | Rotate refresh token, new access token |
| `POST /auth/logout` | public | Revoke current session, clear cookie |
| `POST /auth/logout-all` | user | Revoke every session on every device |
| `GET /auth/me` | user | Current user |
| `POST /auth/change-password` | user | Change password (revokes other sessions) |
| `POST /auth/forgot-password` | public | Email a reset link (always 200) |
| `POST /auth/reset-password` | public | Set a new password with the reset token |
| `GET/PATCH /users/me` | user | Own profile |
| `GET /users`, `GET /users/:id` | admin, manager | List (paginate/filter/search/sort) / read |
| `POST /users`, `PATCH /users/:id`, `DELETE /users/:id` | admin | Manage users and roles |
| `GET/POST /examples`, `GET/PATCH/DELETE /examples/:id` | user | Example CRUD (own records; admin/manager see all) |
| `POST /files/images` | user | Upload 1–5 images (`multipart/form-data`, field `images`) |
| `POST /files` | user | Upload files (field `files`): images, PDF, DOCX, XLSX, PPTX, ZIP, TXT, CSV |
| `GET /files`, `GET /files/:id` | user | List (paginate/filter `kind`/search/sort) / metadata |
| `GET /files/:id/download` | user | Download as attachment with the original name |
| `GET /files/:id/view` | user | Display an image inline |
| `DELETE /files/:id` | user | Delete record and file content |

### Try it with curl

```bash
BASE=http://localhost:5000/api/v1

# register (stores the refresh-token cookie in cookies.txt)
curl -s -c cookies.txt -H 'Content-Type: application/json' \
  -d '{"name":"Jane Doe","email":"jane@example.com","password":"Passw0rd!secure"}' $BASE/auth/register

# use the accessToken from the response
TOKEN=<accessToken>
curl -s -H "Authorization: Bearer $TOKEN" $BASE/auth/me

# create + list with pagination, filter, sort and search
curl -s -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"title":"Write docs","priority":"high","tags":["work"]}' $BASE/examples
curl -s -H "Authorization: Bearer $TOKEN" "$BASE/examples?page=1&limit=10&status=draft&sort=-createdAt&search=docs"

# rotate the refresh token (cookie is read and replaced)
curl -s -b cookies.txt -c cookies.txt -X POST $BASE/auth/refresh
```

### File uploads and downloads

```bash
# upload images (field name "images"), then any file (field name "files")
curl -s -H "Authorization: Bearer $TOKEN" -F "images=@photo.png" $BASE/files/images
curl -s -H "Authorization: Bearer $TOKEN" -F "files=@report.pdf" -F "files=@data.csv" $BASE/files

# download using the id from the upload response
curl -s -H "Authorization: Bearer $TOKEN" -OJ $BASE/files/<id>/download
```

From a browser, `fetch` the `/download` or `/view` URL with the `Authorization` header and turn the response into a blob (`URL.createObjectURL`); plain `<img src>` cannot send the header.

How it works (`src/modules/files`, `src/middlewares/upload.middleware.ts`):

- **multer** writes incoming files to `UPLOAD_DIR/.tmp` with random names; the service then checks the **real type from the file's bytes** (`file-type`), never the extension or client `Content-Type`. Anything not on the allow-list (executables, HTML, SVG, …) gets `415`, and a batch is all-or-nothing.
- Accepted files are stored as `<uuid>.<detected-extension>`; the client file name is sanitised and kept only as metadata for display/download. Stored names are never exposed.
- Limits: `MAX_UPLOAD_SIZE_MB` per file (`413`), `MAX_UPLOAD_FILES` per request, 5 per image request.
- Ownership: users see only their own files (others get `404`); admins/managers see all. Deleting a user does **not** delete their files; add that cleanup to `users.service.ts` if you need it.
- Add or remove allowed types in `files.constants.ts`.
- Files live on local disk. In production mount `UPLOAD_DIR` on a persistent volume, or replace the disk calls in `files.service.ts` with S3/GCS if you run several instances.

### List endpoints

Every list endpoint accepts `page` (default 1), `limit` (default 20, max 100), `sort` (`-createdAt,title`; only whitelisted fields), `search` (case-insensitive, literal match on the module's searchable fields) plus module-specific filters (e.g. `status`, `role`, `tag`).

## Authentication design

- **Access token**: short-lived JWT (HS256) returned in the JSON body; send it as `Authorization: Bearer …`. It carries `sub`, `role` and a `tokenVersion`.
- **Refresh token**: JWT stored only in an `httpOnly`, `Secure` (in production), `SameSite` cookie scoped to `/api/v1/auth`. The server stores just its SHA-256 hash.
- **Rotation**: each `/auth/refresh` revokes the presented token and issues a new one in the same *family*.
- **Reuse detection**: presenting an already-rotated token (or losing a concurrent-refresh race) revokes the entire family, forcing a fresh login. Rotation is atomic, so two simultaneous refreshes cannot both succeed.
- **Instant revocation**: changing/resetting a password or `logout-all` bumps `tokenVersion` (kills access tokens immediately) and revokes all refresh tokens. Suspended/inactive accounts and deleted users are rejected on every request.
- **Passwords**: bcrypt, hashed in the User model's `pre('save')` hook (8–72 chars, a letter and a number required). Login errors are identical for unknown email and wrong password, with equalised timing.
- **Roles**: `user`, `staff`, `manager`, `admin` (edit `users.constants.ts`). Use `authorize('admin', 'manager')` after `authenticate`.
- **Forgot password**: a random single-use token, stored hashed, valid for `PASSWORD_RESET_EXPIRES_MINUTES`. The response never reveals whether an email exists.

> **Email delivery:** this starter has no email provider. In development the reset link is written to the server log. Before going to production implement `sendPasswordResetEmail` in [`src/modules/auth/auth.mailer.ts`](src/modules/auth/auth.mailer.ts) with your provider (Resend, SES, SendGrid, Nodemailer…); in production it currently logs a warning and sends nothing.

## Security checklist (built in)

Helmet · CORS allow-list with credentials · global + stricter auth rate limits · body-size limits (413) · Zod validation of all input · Mongoose `sanitizeFilter` and `strictQuery` · whitelisted sort fields and regex-escaped search · hashed passwords/refresh/reset tokens · `select: false` on private fields and a `toJSON` that strips them · pino logging with credential redaction and request ids · no stack traces outside development · graceful shutdown on `SIGINT`/`SIGTERM`/fatal errors.

## Adding a new module

Example: an `appointments` module.

1. `cp -r src/modules/example src/modules/appointments` and rename the files/identifiers.
2. **Model** – fields, constraints, indexes; reuse `baseSchemaOptions`.
3. **Schema** – Zod `create`, `update` (usually `createSchema.partial()`) and list-query schemas (`paginationQuerySchema.extend({...})`).
4. **Service** – queries, ownership/role rules, `AppError`s. Use `paginate`, `parseSort`, `buildSearchFilter`.
5. **Controller** – call the service, respond with `sendSuccess` / `sendCreated` / `sendPaginated`.
6. **Routes** – `authenticate`, `authorize(...)`, `validate({ ... })`.
7. Mount it in [`src/routes.ts`](src/routes.ts): `router.use('/appointments', appointmentsRoutes);`
8. Document it in `appointments.docs.ts` and add it to `moduleDocs` in [`src/docs/openapi.ts`](src/docs/openapi.ts).
9. Write `tests/appointments.test.ts`, then run `npm run typecheck && npm test && npm run build`.

## Testing

`npm test` boots an in-memory MongoDB (`mongodb-memory-server`) once, gives every test file its own database, and exercises the real Express app through Supertest — no external services needed. The first run downloads a MongoDB binary (cached afterwards in `node_modules/.cache`). Coverage includes registration/login, token rotation and reuse detection, password flows, RBAC, validation, pagination/filtering/sorting/search, ownership isolation, security headers, CORS, rate limiting and error formats.

## Production

```bash
npm run build
NODE_ENV=production npm start      # needs MONGODB_URI and both JWT secrets in the environment
```

- Set real environment variables on the host (do not ship `.env`); `NODE_ENV=production` enables secure cookies and hides docs/stack traces.
- Behind a load balancer or reverse proxy set `TRUST_PROXY` (e.g. `1`) so rate limiting sees client IPs.
- The cookie is `SameSite=Lax` by default. If your SPA is served from a different *site* than the API, set `COOKIE_SAME_SITE=none` (HTTPS required) and keep `CLIENT_ORIGIN` exact.
- Mongoose builds indexes automatically (`autoIndex`). On very large collections, create indexes in a migration and disable it in `src/config/database.ts`.
- The rate limiter uses in-memory storage; when running several instances use a shared store (e.g. `rate-limit-redis`).
- Logs are JSON on stdout (pretty-printed only in development).

## License

MIT

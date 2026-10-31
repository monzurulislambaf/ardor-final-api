# AGENTS.md — Permanent development rules

These rules apply to every change in this repository, for humans and AI coding agents alike.
Read this file before writing code. When a rule and a shortcut conflict, follow the rule.

## Stack

Node.js (>= 20.11), Express 5, TypeScript (strict), MongoDB + Mongoose 9, Zod 4, Vitest + Supertest.
The project compiles to CommonJS (`module: NodeNext`, no `"type": "module"`), so relative imports have **no file extension**.

## The 15 rules

1. **Always use TypeScript.** No `.js` source files, no `any` unless unavoidable (and then commented). `strict` stays on.
2. **Follow the existing modular architecture.** One folder per feature in `src/modules/<name>/` containing exactly: `<name>.model.ts`, `<name>.schema.ts`, `<name>.service.ts`, `<name>.controller.ts`, `<name>.routes.ts` (plus `<name>.docs.ts` for OpenAPI and `<name>.constants.ts` when needed). Copy `src/modules/example/` when starting a module.
3. **Never put database queries directly inside controllers.** Controllers only: read the validated request, call one service method, send the response with `api-response` helpers.
4. **Put business logic inside services.** Services own queries, authorization-by-ownership, transactions, and rules. Routes/controllers contain no business logic.
5. **Validate requests using Zod.** Every route that accepts `body`, `query` or `params` uses `validate({ body, query, params })` with a schema from `<name>.schema.ts`. Never read unvalidated `req.body` fields. Use `objectIdSchema` / `idParamsSchema` for ids and `paginationQuerySchema` for list endpoints.
6. **Use centralized error handling.** Throw `AppError` (e.g. `AppError.notFound('...')`) from services; never call `res.status(4xx/5xx)` by hand in a handler and never swallow errors. Wrap async handlers with `asyncHandler`. Only `middlewares/error.middleware.ts` formats errors.
7. **Reuse existing utilities.** Check `src/utils/` and `src/middlewares/` first: `AppError`, `asyncHandler`, `sendSuccess/sendCreated/sendPaginated`, `paginate`/`parseSort`/`buildSearchFilter`, `objectIdSchema`, `baseSchemaOptions`, `logger`, `createRateLimiter`. Do not re-implement them.
8. **Never duplicate authentication logic.** Token signing/verification lives in `utils/jwt.ts`; credential, session, refresh-rotation and password flows live in `modules/auth/auth.service.ts`; request protection is `authenticate` + `authorize(...roles)`. Protect routes with those middlewares — do not parse JWTs or compare passwords elsewhere. Password hashing happens only in the User model's `pre('save')` hook.
9. **Use Mongoose models and proper indexes.** Define schemas with `baseSchemaOptions` (timestamps, clean JSON), add field constraints (`required`, `enum`, `maxlength`, `unique`), and add an index for every field combination you filter or sort on. Reference other documents with `Schema.Types.ObjectId` + `ref`.
10. **Never expose sensitive user information.** No password hashes, token hashes, reset tokens, `tokenVersion`, or stack traces in responses or logs. Sensitive schema fields use `select: false`; the User `toJSON` strips private fields. Do not log request bodies or headers beyond what `logger.ts` already redacts.
11. **Maintain consistent API response formats.** Success: `{ success: true, message, data }` (lists add `meta.pagination`). Error: `{ success: false, message, errors: [{ field?, message }] }`. Always go through `api-response.ts`.
12. **Write tests for new functionality.** Add `tests/<name>.test.ts` (Vitest + Supertest, in-memory MongoDB via `tests/setup.ts`). Cover the happy path, validation errors, authentication/authorization failures, and not-found cases. `npm test`, `npm run typecheck` and `npm run build` must pass before you finish.
13. **Do not install unnecessary dependencies.** Prefer the standard library and existing packages. Justify any new dependency in the PR/commit message; update `package-lock.json` by using npm, never by hand.
14. **Do not modify unrelated modules when adding a feature.** Touch only the new module, the route registry (`src/routes.ts`), the docs registry (`src/docs/openapi.ts`), and shared code that genuinely needs the change. Keep diffs small and focused.
15. **Update API documentation when adding endpoints.** Add/extend the module's `<name>.docs.ts` (request bodies and query parameters are generated from the Zod schemas via `docs/common.ts`), register it in `src/docs/openapi.ts`, and update the README endpoint table if it changes the public surface.

## Conventions

- **Layering:** `routes → (middlewares) → controller → service → model`. Dependencies only point downward. A service may call another module's *service*, never its controller.
- **Naming:** files `kebab-case` with role suffix (`orders.service.ts`); exports `camelCase` objects for services/controllers (`ordersService`), `PascalCase` for models/types.
- **Environment:** read configuration only through `src/config/env.ts` (Zod-validated). Never read `process.env` elsewhere. Add new variables to the schema **and** `.env.example`.
- **Mongoose 9 notes:** the type is `QueryFilter` (not `FilterQuery`); `pre` hooks are `async` functions without `next`. `sanitizeFilter` is enabled globally, so query operators inside filter *values* (`{ field: { $gt: x } }`) must be wrapped with `mongoose.trusted({ ... })`; prefer simple equality filters or JS-side checks, and never pass client objects into filters.
- **Express 5 notes:** `req.query` is a getter — `validate()` redefines it, so read parsed values from `req.query` after validation (cast to the schema's inferred type). Use `/:id` style params; wildcard routes need names (`/*splat`).
- **Authorization data scoping:** if a record belongs to a user, scope queries in the service (see `example.service.ts`) and return 404, not 403, for records the caller may not see.
- **Roles:** add roles in `users.constants.ts`; restrict routes with `authorize('admin', ...)`. Public registration must never accept a role.
- **Pagination/sort/search:** list endpoints extend `paginationQuerySchema`, whitelist sortable and searchable fields in the service, and return through `sendPaginated`.
- **Uploads:** parse multipart with `uploadFiles(field, max)` from `upload.middleware.ts` and handle the files in a service. Validate type by content (see `files.service.ts`), never by client name/`Content-Type`; never use client file names in paths; clean up temp files on every failure path. `file-type` is ESM-only, so load it with `import()` as `files.service.ts` does.
- **Logging:** use `logger` (or `req.log` inside a request) — never `console.log` in application code.
- **Comments:** explain *why*, not *what*. Keep the existing density.

## Adding a new module (checklist)

1. Copy `src/modules/example/` to `src/modules/<name>/` and rename files/symbols.
2. Model: fields, constraints, indexes, `baseSchemaOptions`.
3. Schema: Zod create/update/list-query schemas + inferred types.
4. Service: all queries and business rules; throw `AppError`.
5. Controller: thin handlers using `asyncHandler` + response helpers.
6. Routes: `authenticate`, `authorize` where needed, `validate`.
7. Mount in `src/routes.ts`; document in `<name>.docs.ts` and register in `src/docs/openapi.ts`.
8. Tests in `tests/<name>.test.ts`; run `npm run typecheck && npm test && npm run build`.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Dev server with auto-reload (tsx watch) |
| `npm run typecheck` | Type-check `src/` and `tests/` |
| `npm test` | Vitest + Supertest against an in-memory MongoDB |
| `npm run build` | Clean, then compile to `dist/` |
| `npm start` | Run the compiled server (`dist/server.js`) |
| `npm run create-admin -- <email> <password> [name]` | Create or promote an admin |

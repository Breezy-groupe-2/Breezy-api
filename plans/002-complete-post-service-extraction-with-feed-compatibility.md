# Plan 002: Complete post-service extraction with feed compatibility

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report; do not improvise. When done, update the status row for this plan
> in `plans/README.md` unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**:
> `git diff --stat 3b3ecac..HEAD -- auth-service/src/app.js auth-service/src/models auth-service/src/services/feed.service.js auth-service/src/tests/feed.test.js auth-service/src/tests/helpers/api-test-utils.js auth-service/src/tests/like.test.js auth-service/src/tests/post.test.js auth-service/src/tests/post.update.test.js auth-service/src/tests/user.posts.test.js post-service/src post-service/package.json package.json`
>
> This plan was written after Plan 001 stopped with partial, uncommitted
> post-service extraction edits in the working tree. If those files differ
> from the "Current state" excerpts below, inspect the live code and continue
> only if the intent is still clear: post/like behavior moves to
> `post-service`, and auth-service feed remains a temporary compatibility
> adapter until Plan 005.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: plans/001-establish-real-microservice-boundaries.md is BLOCKED and superseded by this narrower slice
- **Category**: migration, tests, architecture
- **Planned at**: commit `3b3ecac`, 2026-06-14

## Why this matters

The first execution of Plan 001 moved posts out of `auth-service` before feed
tests had a replacement data contract, so `npm test` failed in
`auth-service/src/tests/feed.test.js`. This plan completes only the post/like
extraction and deliberately keeps feed compatibility in place. The codebase
should be green after this slice, even though full feed ownership is deferred
to a later plan.

## Current state

The working tree is expected to contain partial edits from the stopped
execution:

```js
// auth-service/src/app.js
app.use('/api/v1/auth', userRoutes);
app.get('/api/v1/users/me', authenticate, me);
app.use('/api/v1/feed', feedRoutes);
```

```js
// auth-service/src/services/feed.service.js
const Post = require('../models/post.model');
const User = require('../models/user.model');
```

```js
// auth-service/src/tests/helpers/api-test-utils.js
const postServiceApp = require('../../../../post-service/src/app');
const Like = require('../../../../post-service/src/models/like.model');
const Post = require('../../../../post-service/src/models/post.model');
```

```js
// post-service/src/app.js
app.use('/api/v1/posts', postRoutes);
```

```js
// post-service/src/routes/post/post.routes.js
router.get('/me', authenticate, getOwnPosts);
router.get('/user/:userId', getPostsByUser);
router.post('/', authenticate, validate(postContentSchema), createPost);
router.put('/:id', authenticate, validate(postContentSchema), updatePost);
router.post('/:id/like', authenticate, likePost);
router.delete('/:id/like', authenticate, unlikePost);
```

Repository conventions to match:

- CommonJS modules and Express apps exported from `src/app.js`.
- Thin controllers call service modules, matching the existing
  `post-service/src/controllers/post.controller.js` style.
- Zod validation at the route boundary, matching
  `post-service/src/middlewares/validate.js`.
- Vitest + Supertest endpoint tests with MongoMemoryServer.
- Conventional Commits; branch name is `feature/architecture-reorganization`.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Unit tests | `npm test` | exit 0; all unit suites pass |
| Post/feed focused tests | `npx vitest run auth-service/src/tests/post.test.js auth-service/src/tests/post.update.test.js auth-service/src/tests/like.test.js auth-service/src/tests/user.posts.test.js auth-service/src/tests/feed.test.js --passWithNoTests` | exit 0 |
| Lint | `npm run lint` | exit 0; no errors |
| Acceptance detail | `npx vitest run --config vitest.acceptance.config.js --reporter=verbose --passWithNoTests` | Fx3 and Fx6 pass; other deferred features may still fail |

If MongoMemoryServer fails with `listen EPERM`, rerun in an environment where
local port binding is allowed. Do not change tests just to work around sandbox
port restrictions.

## Scope

**In scope**:

- `auth-service/src/app.js`
- `auth-service/src/models/post.model.js`
- `auth-service/src/models/like.model.js`
- `auth-service/src/services/feed.service.js`
- `auth-service/src/tests/feed.test.js`
- `auth-service/src/tests/helpers/api-test-utils.js`
- `auth-service/src/tests/like.test.js`
- `auth-service/src/tests/post.test.js`
- `auth-service/src/tests/post.update.test.js`
- `auth-service/src/tests/user.posts.test.js`
- `post-service/package.json`
- `post-service/src/**`
- `plans/README.md`

**Out of scope**:

- Comment, follow, feed ownership extraction beyond the temporary adapter.
- Profile routes.
- Docker Compose or Nginx gateway routing.
- OpenAPI docs.
- Frontend work.

## Git workflow

- Branch: `feature/architecture-reorganization`
- Commit after the focused tests pass.
- Suggested commit message: `feat(posts): complete post service extraction`
- Do not push or open a PR unless the operator explicitly asks.

## Steps

### Step 1: Stabilize the stopped partial extraction

Inspect `git status --short`. Keep the partial post-service files already
created by the stopped execution. Confirm that `auth-service/src/app.js` no
longer mounts `postRoutes` and that `post-service/src/app.js` mounts
`/api/v1/posts`.

If the partial files are absent, recreate them from the old auth-service post
domain following the same structure already listed in this plan.

**Verify**:
`rg -n "postRoutes|app.use\\('/api/v1/posts'" auth-service/src/app.js post-service/src/app.js`
shows `/api/v1/posts` only in `post-service/src/app.js`.

### Step 2: Make feed tests use the same post model as post-service

Update `auth-service/src/services/feed.service.js` so the temporary
auth-service feed adapter reads the post model owned by post-service:

```js
const Post = require('../../../post-service/src/models/post.model');
```

Keep `User` in auth-service for this temporary adapter because follow
extraction is not part of this plan. Add a short comment above the `Post`
import explaining that this is temporary compatibility until feed-service owns
timeline composition.

Do not restore `auth-service` post routes.

**Verify**:
`npx vitest run auth-service/src/tests/feed.test.js --passWithNoTests` exits 0.

### Step 3: Finish post-service validation and error behavior

In `post-service/src/middlewares/validate.js` and
`post-service/src/services/post.service.js`, ensure:

- whitespace-only content is rejected with HTTP 400 before persistence;
- content longer than 280 characters is rejected with HTTP 400;
- malformed post IDs return the same JSON error envelope as not-found IDs;
- unauthorized post update returns HTTP 403.

The stopped execution already uses `z.string().trim().min(1).max(280)`;
preserve that unless tests show a gap.

**Verify**:
`npx vitest run auth-service/src/tests/post.test.js auth-service/src/tests/post.update.test.js --passWithNoTests`
exits 0.

### Step 4: Finish like ownership in post-service

Confirm `post-service/src/controllers/like.controller.js`,
`post-service/src/services/like.service.js`, and
`post-service/src/models/like.model.js` implement like/unlike under
`/api/v1/posts/:id/like`. Use the same JWT payload contract as auth-service:
`req.user.sub` is the authenticated user id.

Public responses must not include `email` or `passwordHash`.

**Verify**:
`npx vitest run auth-service/src/tests/like.test.js auth-service/src/tests/user.posts.test.js --passWithNoTests`
exits 0.

### Step 5: Run the full local checks for this slice

Run the full unit suite and lint after the focused checks are green.

**Verify**:

- `npm test` exits 0.
- `npm run lint` exits 0.
- Direct acceptance command shows Fx3 and Fx6 passing through the composed
  public contract.

## Test plan

- Keep the existing auth-service test files as compatibility tests for the
  public `/api/v1/posts` and `/api/v1/feed` behavior during migration.
- Do not add broad new acceptance coverage here; Plan 005 owns the final feed
  extraction.
- If adding post-service-local tests, place them in `post-service/src/tests/`
  and mirror the Supertest style from `auth-service/src/tests/post.test.js`.

## Done criteria

All must hold:

- [ ] `npm test` exits 0.
- [ ] `npm run lint` exits 0.
- [ ] Focused post, like, user-post, and feed tests exit 0.
- [ ] `auth-service/src/app.js` does not mount `/api/v1/posts`.
- [ ] `post-service/src/app.js` mounts `/api/v1/posts`.
- [ ] Feed tests pass without restoring auth-service post ownership.
- [ ] Temporary feed compatibility is documented in code.
- [ ] No files outside this plan's in-scope list are modified.
- [ ] `plans/README.md` status row updated.

## STOP conditions

Stop and report back if:

- Passing feed tests appears to require restoring `/api/v1/posts` in
  `auth-service`.
- The post-service route shape must change away from `/api/v1/posts`.
- A verification command fails twice after a reasonable fix attempt.
- You need to touch comment, follow, profile, gateway, or Docker files.
- You discover the stopped execution's partial source changes are missing and
  cannot be recreated from the current auth-service post files.

## Maintenance notes

This plan intentionally leaves feed in a temporary compatibility state. The
reviewer should scrutinize that the compatibility is explicit and narrow:
auth-service may read the post-service model only to keep feed tests green
until Plan 005 moves feed ownership. Do not add new feed features in
auth-service after this lands.

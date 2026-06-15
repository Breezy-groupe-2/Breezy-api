# Plan 003: Align comment-service with public `/api/v1` routes

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report; do not improvise. When done, update the status row for this plan
> in `plans/README.md` unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**:
> `git diff --stat 3b3ecac..HEAD -- comment-service/src api-gateway/nginx.conf auth-service/src/tests/breezy.acceptance.test.js auth-service/src/tests/helpers/api-test-utils.js`
>
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding. On a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: plans/002-complete-post-service-extraction-with-feed-compatibility.md
- **Category**: migration, tests, architecture
- **Planned at**: commit `3b3ecac`, 2026-06-14

## Why this matters

The comment service contains real comment/reply behavior, but it is mounted
under private-looking paths without `/api/v1`. The gateway and OpenAPI contract
must expose comments and replies at the same public route shape used by the
acceptance tests. This slice fixes comment ownership without touching posts,
follows, feed, or profiles.

## Current state

Expected route mismatch:

```js
// comment-service/src/app.js
app.use('/api/posts/:postId/comments', commentRoutes);
app.use('/api/comments/:commentId/replies', replyRoutes);
```

Plan 002's composed test helper currently mounts auth-service and post-service,
but not comment-service yet:

```js
// auth-service/src/tests/helpers/api-test-utils.js
const authServiceApp = require('../../app');
const postServiceApp = require('../../../../post-service/src/app');

const app = express();
app.use(authServiceApp);
app.use(postServiceApp);
```

This plan must add `commentServiceApp` to that composed public-contract helper.

Repository conventions:

- Express app exported from `comment-service/src/app.js`.
- Route handlers live under `comment-service/src/routes/`.
- Tests use Vitest, Supertest, and MongoMemoryServer.
- Zod validation is expected at API boundaries; use the validation middleware
  pattern from `post-service/src/middlewares/validate.js` after Plan 002.

## Commands you will need

| Purpose           | Command                                                                                    | Expected on success |
| ----------------- | ------------------------------------------------------------------------------------------ | ------------------- |
| Comment tests     | `npx vitest run comment-service/src --passWithNoTests`                                     | exit 0              |
| Acceptance detail | `npx vitest run --config vitest.acceptance.config.js --reporter=verbose --passWithNoTests` | Fx7 and Fx8 pass    |
| Unit tests        | `npm test`                                                                                 | exit 0              |
| Lint              | `npm run lint`                                                                             | exit 0              |

## Scope

**In scope**:

- `comment-service/src/**`
- `api-gateway/nginx.conf`
- `auth-service/src/tests/breezy.acceptance.test.js`
- `auth-service/src/tests/helpers/api-test-utils.js`
- New comment-service tests under `comment-service/src/tests/**`
- `plans/README.md`

**Out of scope**:

- Post-service behavior except using existing post IDs in tests.
- Follow/feed/profile extraction.
- Docker Compose service definitions unless the existing comment-service
  container is missing entirely.
- Changing public paths away from OpenAPI.

## Git workflow

- Branch: `feature/architecture-reorganization`
- Suggested commit message: `feat(comments): align service routes with api v1`
- Do not push or open a PR unless the operator explicitly asks.

## Steps

### Step 1: Mount public comment and reply routes in comment-service

Update `comment-service/src/app.js` so the service owns:

- `POST /api/v1/posts/:postId/comments`
- `GET /api/v1/posts/:postId/comments`
- `POST /api/v1/comments/:commentId/replies`
- `GET /api/v1/comments/:commentId/replies` if reply listing exists today.

Do not keep the old non-versioned routes unless an existing unit test proves
backward compatibility is required. If old routes are retained, add a comment
that they are legacy and outside the public gateway contract.

**Verify**:
`rg -n "app.use\\('/api" comment-service/src/app.js`
shows `/api/v1/posts/:postId/comments` and `/api/v1/comments/:commentId/replies`.

### Step 2: Add Zod validation for comment and reply bodies

Create or update comment-service validation middleware so comment and reply
content:

- must be a string;
- trims whitespace;
- rejects empty or whitespace-only content with HTTP 400;
- rejects content over 280 characters with HTTP 400.

Match the JSON error envelope used by post-service validation:
`{ error: 'Validation failed', details: [...] }`.

**Verify**:
`npx vitest run comment-service/src --passWithNoTests` exits 0.

### Step 3: Route gateway traffic to comment-service before post-service

Update `api-gateway/nginx.conf` so comment paths under posts are matched before
the broader `/api/v1/posts` location. Nginx prefix ordering must ensure
`/api/v1/posts/:postId/comments` reaches comment-service, not post-service.

Also route `/api/v1/comments/:commentId/replies` to comment-service.

**Verify**:
`docker compose config` exits 0.

### Step 4: Confirm acceptance coverage

Mount comment-service in `auth-service/src/tests/helpers/api-test-utils.js`
after `postServiceApp` so acceptance tests exercise the public composed
contract:

```js
const commentServiceApp = require('../../../../comment-service/src/app');

app.use(authServiceApp);
app.use(postServiceApp);
app.use(commentServiceApp);
```

Run direct acceptance detail and inspect Fx7/Fx8. Fix only comment-service,
gateway routing, or test-helper route wiring problems.

**Verify**:

- Direct acceptance shows Fx7 and Fx8 passing.
- `npm test` exits 0.
- `npm run lint` exits 0.

## Test plan

- Add or update comment-service tests for create/list comments, create/list
  replies, empty content, whitespace-only content, overlength content, and
  unauthorized mutation if auth is required.
- Use the existing `comment-service/src/tests/comment.test.js` style if it
  exists.
- Acceptance Fx7/Fx8 are the public contract check.

## Done criteria

- [ ] Comment-service mounts `/api/v1` comment and reply routes.
- [ ] Gateway routes comment and reply public paths to comment-service.
- [ ] Zod validation rejects empty, whitespace-only, and overlength content.
- [ ] Fx7 and Fx8 pass through direct acceptance.
- [ ] `npm test`, `npm run lint`, and `docker compose config` exit 0.
- [ ] No files outside scope are modified.
- [ ] `plans/README.md` status row updated.

## STOP conditions

Stop and report back if:

- Comment acceptance requires changing public paths away from `/api/v1`.
- Gateway matching cannot route comments before posts without changing
  post-service behavior.
- A verification command fails twice after a reasonable fix attempt.
- The implementation appears to require a new database technology or broker.

## Maintenance notes

This plan should leave comments and replies with one clear owner:
`comment-service`. Later plans must not move comment logic back into
auth-service or post-service for convenience.

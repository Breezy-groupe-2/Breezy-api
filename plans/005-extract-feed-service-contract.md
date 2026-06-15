# Plan 005: Move feed ownership to feed-service through explicit contracts

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report; do not improvise. When done, update the status row for this plan
> in `plans/README.md` unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**:
> `git diff --stat 86a2d75..HEAD -- feed-service/src auth-service/src/app.js auth-service/src/routes/feed auth-service/src/services/feed.service.js auth-service/src/tests/feed.test.js auth-service/src/tests/helpers/api-test-utils.js follow-service/src docker-compose.yml api-gateway/nginx.conf docs/tooling.md`
>
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding. On a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: HIGH
- **Depends on**: plans/002-complete-post-service-extraction-with-feed-compatibility.md, plans/004-extract-follow-service.md
- **Category**: migration, tests, architecture
- **Planned at**: commit `86a2d75`, 2026-06-15

## Why this matters

Feed behavior is currently the main boundary conflict: it reads follow data
from auth-service and post data from post-service-compatible models. This plan
removes the temporary adapter from Plan 002 and makes feed-service the public
owner of `/api/v1/feed` through an explicit post/follow contract.

## Current state

After Plan 004, auth-service may still temporarily mount feed routes:

```js
// auth-service/src/app.js
app.use('/api/v1/feed', feedRoutes);
```

The temporary feed service reads user follow state and post documents:

```js
// auth-service/src/services/feed.service.js
const user = await User.findById(userId);
const posts = await Post.find({ author: { $in: user.following } });
```

Feed-service is expected to be a placeholder before this plan:

```js
// feed-service/src/app.js
// app.use('/api/feed', feedRoutes);
```

The composed acceptance helper currently mounts auth-service, post-service,
comment-service, and follow-service, but not feed-service:

```js
// auth-service/src/tests/helpers/api-test-utils.js
const authServiceApp = require('../../app');
const postServiceApp = require('../../../../post-service/src/app');
const commentServiceApp = require('../../../../comment-service/src/app');
const followServiceApp = require('../../../../follow-service/src/app');

const app = express();
app.use(authServiceApp);
app.use(postServiceApp);
app.use(commentServiceApp);
app.use(followServiceApp);
```

Chosen contract for this course-stage plan: shared MongoDB read model with
clear ownership comments. Feed-service may read the post and follow collections
but must not create posts, likes, users, or follows. This avoids introducing a
broker or service-to-service HTTP client before the project needs it.

## Commands you will need

| Purpose           | Command                                                                                    | Expected on success |
| ----------------- | ------------------------------------------------------------------------------------------ | ------------------- |
| Feed tests        | `npx vitest run feed-service/src auth-service/src/tests/feed.test.js --passWithNoTests`    | exit 0              |
| Acceptance detail | `npx vitest run --config vitest.acceptance.config.js --reporter=verbose --passWithNoTests` | Fx5 passes          |
| Unit tests        | `npm test`                                                                                 | exit 0              |
| Compose config    | `docker compose config`                                                                    | exit 0              |
| Lint              | `npm run lint`                                                                             | exit 0              |

## Scope

**In scope**:

- `feed-service/src/**`
- `auth-service/src/app.js`
- `auth-service/src/routes/feed/**`
- `auth-service/src/services/feed.service.js`
- `auth-service/src/tests/feed.test.js`
- `auth-service/src/tests/helpers/api-test-utils.js`
- `docker-compose.yml`
- `api-gateway/nginx.conf`
- `docs/tooling.md`
- `plans/README.md`

**Out of scope**:

- Post, comment, follow, or profile mutations.
- Introducing HTTP service clients, brokers, or a new database.
- Frontend work.

## Git workflow

- Branch: `feature/architecture-reorganization`
- Suggested commit message: `feat(feed): move timeline ownership to feed service`
- Do not push or open a PR unless the operator explicitly asks.

## Steps

### Step 1: Implement feed-service routes and auth

Create feed-service route, controller, service, model/read-model imports, and
JWT auth middleware. Mount `GET /api/v1/feed` from `feed-service/src/app.js`.

The feed response must return followed users' posts sorted newest first and
must return HTTP 401 without a valid token.

**Verify**:
`npx vitest run feed-service/src --passWithNoTests` exits 0.

### Step 2: Move tests and composed helper to feed-service

Update `auth-service/src/tests/feed.test.js` or move equivalent tests to
`feed-service/src/tests/feed.test.js`. The composed acceptance helper must
mount `feed-service/src/app.js`, not auth-service feed routes.

**Verify**:
`npx vitest run feed-service/src auth-service/src/tests/feed.test.js --passWithNoTests`
exits 0. If the auth-service feed test file is removed, the command should
still exit 0 with feed-service tests present.

### Step 3: Remove auth-service feed ownership

Remove `feedRoutes` from `auth-service/src/app.js`. Delete or stop exporting
auth-service feed route/controller/service files if they are no longer used.
Auth-service should retain auth, registration/login, and `/api/v1/users/me`.

**Verify**:
`rg -n "feedRoutes|/api/v1/feed|getFeed" auth-service/src/app.js auth-service/src/routes auth-service/src/controllers auth-service/src/services`
returns no ownership matches.

### Step 4: Wire gateway and compose

Update `api-gateway/nginx.conf` so `/api/v1/feed` routes to feed-service.
Update `docker-compose.yml` with any environment variables needed for
feed-service to read the shared MongoDB collections.

**Verify**:
`docker compose config` exits 0.

### Step 5: Run full verification

**Verify**:

- Direct acceptance shows Fx5 passing.
- `npm test` exits 0.
- `npm run lint` exits 0.

## Test plan

- Feed-service tests must cover empty feed, followed-user posts newest first,
  non-followed posts excluded, missing token 401, and nonexistent user 404 if
  the service preserves that behavior.
- Acceptance Fx5 is the public contract.

## Done criteria

- [ ] Feed-service owns `GET /api/v1/feed`.
- [ ] Auth-service no longer mounts or owns feed routes.
- [ ] Feed-service read-model ownership is documented in code or
      `docs/tooling.md`.
- [ ] Fx5 passes.
- [ ] `npm test`, `npm run lint`, and `docker compose config` exit 0.
- [ ] No files outside scope are modified.
- [ ] `plans/README.md` status row updated.

## STOP conditions

Stop and report back if:

- Feed extraction requires changing `/api/v1/feed`.
- Passing Fx5 requires moving post or follow mutations into feed-service.
- A verification command fails twice after a reasonable fix attempt.
- The chosen shared-read-model contract conflicts with a project decision doc.

## Maintenance notes

The shared-read-model contract is a pragmatic course-stage boundary. If Breezy
later needs independent deployments, replace this with service-to-service HTTP
or event-driven read models and add service-to-service auth.

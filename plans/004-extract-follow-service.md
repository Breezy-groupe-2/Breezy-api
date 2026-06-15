# Plan 004: Extract follow ownership from auth-service

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report; do not improvise. When done, update the status row for this plan
> in `plans/README.md` unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**:
> `git diff --stat da326ef..HEAD -- auth-service/src/routes/user auth-service/src/controllers/follow.controller.js auth-service/src/services/follow.service.js auth-service/src/models/follow.model.js auth-service/src/models/user.model.js auth-service/src/tests auth-service/src/tests/helpers/api-test-utils.js docker-compose.yml api-gateway/nginx.conf follow-service`
>
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding. On a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: plans/002-complete-post-service-extraction-with-feed-compatibility.md, plans/003-align-comment-service-api-v1.md
- **Category**: migration, security, tests, architecture
- **Planned at**: commit `da326ef`, 2026-06-15

## Why this matters

Follow/follower behavior is social-domain logic and should not live inside
auth routes. It is also authorization-sensitive and currently risks exposing
private fields in public relationship responses. This plan creates a dedicated
follow owner before feed-service depends on a stable follow contract.

## Current state

Auth-service currently wires follow routes through user routes:

```js
// auth-service/src/routes/user/user.routes.js
const followRoutes = require('./user.follow.routes');
router.use('/:id', followRoutes);
```

The composed acceptance helper currently mounts auth, post, and comment
services, but not follow-service:

```js
// auth-service/src/tests/helpers/api-test-utils.js
const authServiceApp = require('../../app');
const postServiceApp = require('../../../../post-service/src/app');
const commentServiceApp = require('../../../../comment-service/src/app');

const app = express();
app.use(authServiceApp);
app.use(postServiceApp);
app.use(commentServiceApp);
```

The original follow service populated email addresses:

```js
// auth-service/src/services/follow.service.js
const follows = await Follow.find({ following: userId }).populate('follower', 'username email');
```

The temporary feed adapter still reads `User.following` until Plan 005 moves
feed ownership:

```js
// auth-service/src/services/feed.service.js
const user = await User.findById(userId);
const posts = await Post.find({ author: { $in: user.following } })
```

Current acceptance Fx9 expects follower/following responses to contain at
least public `id` fields and expects a follow action to make followed posts
visible in `/api/v1/feed`.

Required public routes:

- `POST /api/v1/users/:id/follow`
- `DELETE /api/v1/users/:id/follow`
- `GET /api/v1/users/:id/followers`
- `GET /api/v1/users/:id/following`

Repository conventions:

- New services use `src/app.js`, `src/server.js`, `package.json`, and
  `Dockerfile` like `post-service` and `comment-service`.
- JWT authentication reads `Authorization: Bearer <token>` and uses
  `req.user.sub` as the authenticated user id.
- Tests use Vitest, Supertest, and MongoMemoryServer.
- Course-stage data contract: `follow-service` may use the existing auth
  MongoDB database/read models for `User` and `Follow` until Plan 005 removes
  feed's dependency on `User.following`. Document this temporary shared
  read/write model in code or `docs/tooling.md`. Do not introduce a new
  database technology.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Follow tests | `npx vitest run follow-service/src --passWithNoTests` | exit 0 |
| Acceptance detail | `npx vitest run --config vitest.acceptance.config.js --reporter=verbose --passWithNoTests` | Fx9 passes |
| Unit tests | `npm test` | exit 0 |
| Compose config | `docker compose config` | exit 0 |
| Lint | `npm run lint` | exit 0 |

## Scope

**In scope**:

- New `follow-service/**`
- `auth-service/src/routes/user/**`
- `auth-service/src/services/follow.service.js`
- `auth-service/src/models/follow.model.js`
- `auth-service/src/models/user.model.js`
- `auth-service/src/tests/**`
- `auth-service/src/tests/helpers/api-test-utils.js`
- `docker-compose.yml`
- `api-gateway/nginx.conf`
- `docs/tooling.md`
- `plans/README.md`

**Out of scope**:

- Feed-service extraction.
- Profile-service extraction.
- Post/comment behavior.
- Introducing a broker or new database technology.

## Git workflow

- Branch: `feature/architecture-reorganization`
- Suggested commit message: `feat(follows): extract follow service`
- Do not push or open a PR unless the operator explicitly asks.

## Steps

### Step 1: Create follow-service using the existing service pattern

Create `follow-service` with the same basic structure as `post-service`:

- `package.json`
- `Dockerfile`
- `src/app.js`
- `src/server.js`
- `src/config/database.js`
- `src/models/follow.model.js`
- `src/controllers/follow.controller.js`
- `src/services/follow.service.js`
- `src/routes/follow.routes.js`
- `src/middlewares/authenticate.js`

Use the same MongoDB connection approach and JWT verification contract as the
other services. For this migration slice, connect follow-service to the same
MongoDB database used by auth-service. In Docker Compose, this means
follow-service should depend on `auth-db` and use the auth MongoDB URI, not a
new `follow-db`. This is a temporary shared model so feed compatibility keeps
working until Plan 005.

**Verify**:
`find follow-service -maxdepth 3 -type f | sort` shows the files above.

### Step 2: Implement public follow routes without private data leakage

Move or recreate follow behavior under:

- `POST /api/v1/users/:id/follow`
- `DELETE /api/v1/users/:id/follow`
- `GET /api/v1/users/:id/followers`
- `GET /api/v1/users/:id/following`

Follower/following responses may include public profile summary fields such as
`id`, `username`, `displayName`, and `avatarUrl`. They must not include
`email`, `password`, or `passwordHash`.

While feed remains a temporary auth-service adapter, follow/unfollow must also
maintain `User.following`:

- on follow, add `followingId` to the follower user's `following` array without
  duplicates;
- on unfollow, remove `followingId` from the follower user's `following` array.

Keep writing the `Follow` collection too. Plan 005 will make feed consume the
follow owner directly and remove this compatibility requirement.

**Verify**:
`npx vitest run follow-service/src --passWithNoTests` exits 0.

### Step 3: Wire follow-service into tests, gateway, and compose

Update the composed acceptance helper to mount `follow-service/src/app.js`
after comment-service:

```js
const followServiceApp = require('../../../../follow-service/src/app');

app.use(authServiceApp);
app.use(postServiceApp);
app.use(commentServiceApp);
app.use(followServiceApp);
```

Update `api-gateway/nginx.conf` so `/api/v1/users/:id/follow`,
`/followers`, and `/following` reach follow-service. Add follow-service to
`docker-compose.yml` with its own port and auth-db dependency. Do not add a
new `follow-db` in this plan.

**Verify**:
`docker compose config` exits 0.

### Step 4: Remove follow route ownership from auth-service

Remove auth-service follow route mounting and leave auth-service responsible
for registration, login, and current identity only. If model files remain for
shared MongoMemoryServer test compatibility, add a comment explaining the
temporary state and remove route ownership.

**Verify**:
`rg -n "followRoutes|followUser|unfollowUser|followers|following" auth-service/src/routes auth-service/src/controllers`
returns no auth route/controller ownership matches.

### Step 5: Run full verification

**Verify**:

- `npx vitest run --config vitest.acceptance.config.js --reporter=verbose --passWithNoTests` shows Fx9 passing.
- `npm test` exits 0.
- `npm run lint` exits 0.

## Test plan

- Add follow-service route tests for follow, unfollow, duplicate follow,
  self-follow rejection, missing token, followers listing, following listing,
  and no private field leakage.
- Keep existing acceptance Fx9 as the public contract.

## Done criteria

- [ ] Follow routes are served by follow-service.
- [ ] Auth-service no longer owns follow routes.
- [ ] Follow/unfollow maintains `User.following` until Plan 005 removes the
  feed compatibility dependency.
- [ ] Public follow responses do not include `email` or `passwordHash`.
- [ ] Fx9 passes.
- [ ] `npm test`, `npm run lint`, and `docker compose config` exit 0.
- [ ] No files outside scope are modified.
- [ ] `plans/README.md` status row updated.

## STOP conditions

Stop and report back if:

- Follow extraction requires changing public route paths.
- Passing tests requires reintroducing follow routes under `/api/v1/auth`.
- A verification command fails twice after a reasonable fix attempt.
- You need a new database technology or broker.
- Passing Fx9 requires adding a separate follow database that cannot access
  the existing `User` data needed by the temporary feed adapter.

## Maintenance notes

Feed-service should consume follow data from this follow-service contract in
Plan 005. Do not add new timeline behavior to follow-service.

# Plan 006: Add profile ownership and finalize architecture docs

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report; do not improvise. When done, update the status row for this plan
> in `plans/README.md` unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**:
> `git diff --stat 86a2d75..HEAD -- auth-service/src/tests/breezy.acceptance.test.js auth-service/src/tests/helpers/api-test-utils.js docker-compose.yml api-gateway/nginx.conf swagger/openapi.json README.md docs/tooling.md follow-service/src`
>
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding. On a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: plans/002-complete-post-service-extraction-with-feed-compatibility.md, plans/003-align-comment-service-api-v1.md, plans/004-extract-follow-service.md, plans/005-extract-feed-service-contract.md
- **Category**: migration, docs, tests, architecture
- **Planned at**: commit `86a2d75`, 2026-06-15

## Why this matters

Profiles are required by the project brief and acceptance features Fx4, Fx10,
and Fx11. They also tie together user identity, follow counts, and a user's
published posts, so they are a useful final boundary check after posts,
comments, follows, and feed have owners. This plan adds profile ownership and
updates docs/OpenAPI to match the real deployment.

## Current state

Acceptance tests expect:

```js
// auth-service/src/tests/breezy.acceptance.test.js
.get(`/api/v1/profiles/${owner.payload.username}/posts`)
.get(`/api/v1/profiles/${account.payload.username}`)
.patch('/api/v1/profiles/me')
```

Profile responses must include public fields such as:

- `displayName`
- `bio`
- `avatarUrl`
- `followerCount`
- `followingCount`
- `postCount`

Profile responses must not include `email`, `password`, or `passwordHash`.

The composed acceptance helper currently mounts auth-service, post-service,
comment-service, and follow-service:

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

Repository conventions:

- New services follow the `post-service`/`follow-service` structure.
- Public paths must remain under `/api/v1`.
- Docs are English and setup notes belong in `README.md` and
  `docs/tooling.md`.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Profile tests | `npx vitest run profile-service/src --passWithNoTests` | exit 0 |
| Acceptance summary | `npm run test:acceptance` | exit 0 and reports `11/11 features work` |
| Unit tests | `npm test` | exit 0 |
| Compose config | `docker compose config` | exit 0 |
| Lint | `npm run lint` | exit 0 |

## Scope

**In scope**:

- New `profile-service/**`
- `auth-service/src/tests/breezy.acceptance.test.js`
- `auth-service/src/tests/helpers/api-test-utils.js`
- `docker-compose.yml`
- `api-gateway/nginx.conf`
- `swagger/openapi.json`
- `README.md`
- `docs/tooling.md`
- `plans/README.md`

**Out of scope**:

- Frontend work.
- Optional tags, media uploads, notifications, private messages, moderation,
  themes, or multilingual UI.
- Reopening post/comment/follow/feed ownership unless a verification failure
  proves their public contract regressed.

## Git workflow

- Branch: `feature/architecture-reorganization`
- Suggested commit message: `feat(profiles): add profile service`
- Do not push or open a PR unless the operator explicitly asks.

## Steps

### Step 1: Create profile-service

Create `profile-service` following the service structure used by the other
services. It should expose:

- `GET /api/v1/profiles/:username`
- `PATCH /api/v1/profiles/me`
- `GET /api/v1/profiles/:username/posts`

Use JWT authentication for `PATCH /api/v1/profiles/me`.

**Verify**:
`find profile-service -maxdepth 3 -type f | sort` shows app, server, config,
routes, controllers, services, models/read-models, middleware, and tests.

### Step 2: Implement public profile responses without private leakage

Profile reads may use shared MongoDB read models for this course-stage plan,
but profile-service must not own registration/login or post creation.

`GET /api/v1/profiles/:username` must return public profile fields and counts.
`GET /api/v1/profiles/:username/posts` must return that user's published posts
newest first with like counts. `PATCH /api/v1/profiles/me` must validate and
update only allowed profile fields.

**Verify**:
`npx vitest run profile-service/src --passWithNoTests` exits 0.

### Step 3: Wire profile-service into gateway, compose, and acceptance helper

Mount profile-service in the composed test helper, route `/api/v1/profiles`
to profile-service in `api-gateway/nginx.conf`, and add profile-service to
`docker-compose.yml`.

**Verify**:
`docker compose config` exits 0.

### Step 4: Update OpenAPI and docs

Update `swagger/openapi.json` to match the implemented public paths and
response shapes. Update `README.md` and `docs/tooling.md` with:

- gateway port `3000`;
- service ports;
- Docker Compose startup;
- note that API service containers and MongoDB are separate containers;
- the current service ownership map.

Remove any stale statement that dependencies are not installed if the repo has
installed dependency metadata and scripts.

**Verify**:
`npm run lint` exits 0.

### Step 5: Run final architecture verification

**Verify**:

- `npm test` exits 0.
- `npm run lint` exits 0.
- `docker compose config` exits 0.
- `npm run test:acceptance` exits 0 and reports `11/11 features work`.

Also run:

`rg -n "postRoutes|feedRoutes|likePost|followUser|Post|Like|Follow" auth-service/src`

Expected result: no auth-service ownership matches except test fixtures or
explicit docs/comments explaining external service/read-model use.

## Test plan

- Profile-service tests for get profile, update own profile, validation
  failure, unauthenticated update 401, user posts newest first, post counts,
  follower/following counts, and no private field leakage.
- Acceptance Fx4, Fx10, and Fx11 are the public contract.
- Final acceptance summary must show all Fx1-Fx11 working.

## Done criteria

- [ ] Profile-service owns `/api/v1/profiles` routes.
- [ ] Fx4, Fx10, and Fx11 pass.
- [ ] `npm run test:acceptance` reports `11/11 features work`.
- [ ] Auth-service owns only auth/identity behavior.
- [ ] `README.md`, `docs/tooling.md`, and `swagger/openapi.json` match the
  architecture Docker Compose starts.
- [ ] `npm test`, `npm run lint`, and `docker compose config` exit 0.
- [ ] No files outside scope are modified.
- [ ] `plans/README.md` status row updated.

## STOP conditions

Stop and report back if:

- Profile acceptance requires changing public paths away from `/api/v1`.
- Implementing profiles requires optional features such as media uploads.
- A verification command fails twice after a reasonable fix attempt.
- Auth-service must regain post, follow, feed, or profile ownership to pass.

## Maintenance notes

This is the final architecture cleanup slice. Reviewers should compare the
service ownership map in docs against actual gateway routes and app mounts.
Any remaining auth-service social behavior should be treated as migration debt
and planned explicitly.

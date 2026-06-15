# Plan 001: Establish real microservice boundaries for Breezy API

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report; do not improvise. When done, update the status row for this plan
> in `plans/README.md` unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**:
> `git diff --stat 3b3ecac..HEAD -- docker-compose.yml api-gateway/nginx.conf auth-service post-service comment-service feed-service swagger/openapi.json auth-service/src/tests/breezy.acceptance.test.js auth-service/src/tests/helpers/api-test-utils.js README.md docs/tooling.md`
>
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding. On a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: HIGH
- **Depends on**: none
- **Category**: migration, tech-debt, tests, architecture
- **Planned at**: commit `3b3ecac`, 2026-06-14
- **Execution status**: BLOCKED on 2026-06-14. The first executor stopped during Step 2 because `npm test` failed twice in `auth-service/src/tests/feed.test.js` after posts were removed from `auth-service` while the auth-service feed route/tests still depended on post data. Before retrying, split or resequence the migration so feed ownership/test updates happen in the same compatibility slice as post extraction, or temporarily preserve a documented feed test adapter until Step 5.

## Why this matters

Breezy is intended to be a real microservice backend, but the implemented product behavior is concentrated in `auth-service`. That makes the current gateway and service folders misleading: Docker starts `post-service` and `feed-service`, but those services are placeholders while the real post, like, follow, and feed routes live in auth. This plan establishes the service ownership, gateway routing, and acceptance-test contract that future feature migrations must follow.

The goal is not to make the gateway route everything to `auth-service`. The goal is to make each service own its bounded context and expose the public `/api/v1/...` routes documented by OpenAPI.

## Current state

Relevant files and roles:

- `auth-service/src/app.js` - currently mounts auth, posts, and feed in one Express app.
- `auth-service/src/services/post.service.js` - implemented post creation, update, and user-post listing.
- `auth-service/src/services/like.service.js` - implemented like/unlike behavior.
- `auth-service/src/services/follow.service.js` - implemented follow/follower behavior.
- `auth-service/src/services/feed.service.js` - implemented feed behavior, but reads `User.following`.
- `post-service/src/app.js` - placeholder service with only `/health`.
- `feed-service/src/app.js` - placeholder service with only `/health`.
- `comment-service/src/app.js` - real comment/reply code exists, but routes are not aligned with `/api/v1`.
- `api-gateway/nginx.conf` - gateway already routes `/api/v1/posts` to `post-service` and `/api/v1/feed` to `feed-service`.
- `auth-service/src/tests/breezy.acceptance.test.js` - acceptance contract for required features, but imports `auth-service` app directly through helpers.
- `swagger/openapi.json` - external API contract already documents `/users`, `/posts`, `/comments`, `/feed`, and `/profiles`.

Current code excerpts to verify before starting:

```js
// auth-service/src/app.js:11
app.use('/api/v1/auth', userRoutes);
app.get('/api/v1/users/me', authenticate, me);
app.use('/api/v1/posts', postRoutes);
app.use('/api/v1/feed', feedRoutes);
```

```js
// post-service/src/app.js:13
// Routes will be added here
// app.use('/api/posts', postRoutes);
```

```js
// feed-service/src/app.js:13
// Routes will be added here
// app.use('/api/feed', feedRoutes);
```

```js
// comment-service/src/app.js:15
app.use('/api/posts/:postId/comments', commentRoutes);
app.use('/api/comments/:commentId/replies', replyRoutes);
```

```nginx
# api-gateway/nginx.conf:34
location /api/v1/posts {
    proxy_pass http://post-service:3002;
}

# api-gateway/nginx.conf:60
location /api/v1/feed {
    proxy_pass http://feed-service:3004;
}
```

Repository conventions to match:

- JavaScript CommonJS modules, Express apps exported from `src/app.js`, server startup in `src/server.js`.
- Thin controllers call service modules; see `auth-service/src/controllers/post.controller.js`.
- Request validation should use Zod at the API boundary; see `auth-service/src/middlewares/validate.js`.
- Endpoint tests use Vitest + Supertest + MongoMemoryServer; see `auth-service/src/tests/auth.test.js` and `comment-service/src/tests/comment.test.js`.
- Git workflow uses Conventional Commits. Example from history: `feat(posts): add post creation endpoint`.

Required service ownership for this project:

- `auth-service`: registration, login, JWT issuance/verification support, current identity only.
- `post-service`: posts and likes.
- `comment-service`: comments and replies.
- `follow-service` or a clearly scoped `user-service`: follows/followers. If creating a new service is too large for this pass, keep it as a named follow module only temporarily and document the next extraction.
- `feed-service`: feed/timeline composition using post and follow data through explicit service contracts.
- `profile-service` or a clearly scoped user-profile service: basic public profiles and profile post display.
- `api-gateway`: the public `/api/v1/...` entry point.

## Commands you will need

| Purpose                  | Command                                                                                    | Expected on success                                                                                                    |
| ------------------------ | ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| Unit tests               | `npm test`                                                                                 | exit 0; current unit suites pass                                                                                       |
| Lint                     | `npm run lint`                                                                             | exit 0; no errors                                                                                                      |
| Acceptance summary       | `npm run test:acceptance`                                                                  | eventually exit 0; after Step 1 it may still fail, but must show real pass/fail counts rather than skipped-only output |
| Direct acceptance detail | `npx vitest run --config vitest.acceptance.config.js --reporter=verbose --passWithNoTests` | useful while fixing; final target is exit 0                                                                            |
| Compose config check     | `docker compose config`                                                                    | exit 0; gateway and service definitions render                                                                         |

Note: MongoMemoryServer may need permission to bind local ports in restricted environments. If tests fail with `listen EPERM`, rerun in an environment where local port binding is allowed instead of changing the tests.

## Scope

**In scope**:

- `api-gateway/nginx.conf`
- `docker-compose.yml`
- `auth-service/src/app.js`
- `auth-service/src/routes/**`
- `auth-service/src/controllers/**`
- `auth-service/src/services/**`
- `auth-service/src/models/**`
- `post-service/src/**`
- `comment-service/src/**`
- `feed-service/src/**`
- New service folder only if needed for follows or profiles, for example `follow-service/**` or `profile-service/**`
- `auth-service/src/tests/**`
- New tests under the services changed by this plan
- `swagger/openapi.json`
- `README.md`
- `docs/tooling.md`
- `plans/README.md`

**Out of scope**:

- Frontend work.
- Optional features such as moderation, custom themes, notifications, private messages, media uploads, or tags.
- Changing the public API away from the `/api/v1` OpenAPI contract unless the OpenAPI file and acceptance tests are updated in the same step.
- Collapsing the architecture back into a single monolith or routing all public endpoints to `auth-service`.

## Git workflow

- Branch: `feature/architecture-reorganization`
- Commit logical slices using Conventional Commits, for example:
  - `test(acceptance): target gateway contract`
  - `feat(posts): move post routes to post service`
  - `feat(comments): align comment service gateway routes`
- Do not push or open a PR unless the operator explicitly asks.

## Steps

### Step 1: Make acceptance tests represent the gateway contract

Change the acceptance test approach so it validates the public microservice contract, not `auth-service` internals. The current helper imports `auth-service/src/app.js` directly:

```js
// auth-service/src/tests/helpers/api-test-utils.js:4
const app = require('../../app');
```

Choose one of these approaches and document the choice in the helper:

- Preferred for integration realism: run the composed services and point Supertest or HTTP requests at the gateway base URL `http://localhost:3000`.
- Acceptable for fast local tests: create a test-only gateway/composed app that mounts service apps under the same paths as Nginx. This must preserve the public `/api/v1/...` routes.

Do not make acceptance tests import `auth-service` for post, comment, follow, feed, or profile behavior.

**Verify**: `npm run test:acceptance` -> it may still fail because features are not moved yet, but the output must show real failed assertions for the public contract, not `0/N passed, N skipped` caused by infrastructure setup.

### Step 2: Move post and like ownership to `post-service`

Port the post and like domain from `auth-service` into `post-service`:

- Move or recreate the relevant models from:
  - `auth-service/src/models/post.model.js`
  - `auth-service/src/models/like.model.js`
- Move or recreate services/controllers/routes from:
  - `auth-service/src/services/post.service.js`
  - `auth-service/src/services/like.service.js`
  - `auth-service/src/controllers/post.controller.js`
  - `auth-service/src/controllers/like.controller.js`
  - `auth-service/src/routes/post/post.routes.js`
- Add authentication middleware to `post-service` that verifies the same JWT contract as `auth-service`.
- Mount public routes in `post-service/src/app.js` under `/api/v1/posts`.
- Keep `auth-service` responsible only for auth and identity routes; remove post and like route mounting from `auth-service/src/app.js`.

Also fix known boundary validation issues while moving:

- Reject whitespace-only post content before Mongoose trimming converts it to empty.
- Validate malformed post IDs before calling `Post.findById`.
- Return consistent JSON errors for validation failures.

**Verify**:

- `npm test` -> all unit tests pass.
- `npx vitest run --config vitest.acceptance.config.js --reporter=verbose --passWithNoTests` -> Fx3 and Fx6 pass through the public contract.

### Step 3: Align comment and reply service with `/api/v1`

Update `comment-service` so it owns comments/replies at the public route shapes documented in OpenAPI:

- `POST /api/v1/posts/:postId/comments`
- `GET /api/v1/posts/:postId/comments`
- `POST /api/v1/comments/:commentId/replies`
- `GET /api/v1/comments/:commentId/replies` if reply listing remains public.

Current service routes omit `/api/v1`:

```js
// comment-service/src/app.js:15
app.use('/api/posts/:postId/comments', commentRoutes);
app.use('/api/comments/:commentId/replies', replyRoutes);
```

Update `api-gateway/nginx.conf` so both `/api/v1/posts/.../comments` and `/api/v1/comments/.../replies` reach `comment-service`. Nginx prefix matching must not let `/api/v1/posts` comments get swallowed by `post-service` unless `post-service` deliberately proxies them.

Add Zod validation for comment/reply bodies. OpenAPI says comments reject empty content and content over 280 characters.

**Verify**:

- `npm test` -> all unit tests pass.
- Direct acceptance -> Fx7 and Fx8 pass through the public contract.

### Step 4: Extract follow ownership out of `auth-service`

Follow/follower behavior must not live under `/api/v1/auth`. Implement it in a dedicated owner:

- Preferred: create `follow-service` with its own `package.json`, `Dockerfile`, app, models, routes, and tests.
- Acceptable if time-constrained: implement a clearly named follow module in an existing user-facing service, but not inside auth routes, and document the extraction TODO in `docs/tooling.md`.

Public routes must match OpenAPI:

- `POST /api/v1/users/:id/follow`
- `DELETE /api/v1/users/:id/follow`
- `GET /api/v1/users/:id/followers`
- `GET /api/v1/users/:id/following`

Do not return email addresses in follower/following public responses. Current code exposes them:

```js
// auth-service/src/services/follow.service.js:28
const follows = await Follow.find({ following: userId }).populate('follower', 'username email');
```

Return public profile summaries only.

**Verify**:

- `npm test` -> all unit tests pass.
- Direct acceptance -> Fx9 follow/follower tests pass.

### Step 5: Rework `feed-service` around explicit service contracts

Feed must be owned by `feed-service`, not `auth-service`. The current feed implementation reads local auth models:

```js
// auth-service/src/services/feed.service.js:5
const user = await User.findById(userId);

// auth-service/src/services/feed.service.js:11
const posts = await Post.find({ author: { $in: user.following } });
```

For this project stage, choose one explicit contract and document it:

- Synchronous HTTP calls from `feed-service` to follow and post services.
- Shared MongoDB read model only if the course brief allows it, with clear ownership notes.
- Event/read-model approach only if already supported by the project timeline.

Avoid the current inconsistent state where `follow.service.js` writes a `Follow` collection but `feed.service.js` reads `User.following`.

**Verify**:

- Direct acceptance -> Fx5 passes after following a user through `/api/v1/users/:id/follow`.
- `docker compose config` -> includes the service URLs or environment variables needed by `feed-service`.

### Step 6: Add profile ownership for required profile endpoints

Implement the required profile endpoints outside `auth-service`:

- `GET /api/v1/profiles/:username`
- `PATCH /api/v1/profiles/me`
- `GET /api/v1/profiles/:username/posts`

OpenAPI already documents these paths in `swagger/openapi.json`. Acceptance tests expect the profile response to contain `displayName`, `bio`, `avatarUrl`, `followerCount`, `followingCount`, and `postCount`, without leaking `email` or `passwordHash`.

If creating a new `profile-service`, add it to `docker-compose.yml` and `api-gateway/nginx.conf`. If keeping profiles temporarily in a user service, document why and keep auth-service out of profile storage/update behavior.

**Verify**:

- Direct acceptance -> Fx4, Fx10, and Fx11 pass.
- `npm run test:acceptance` -> required feature summary shows all Fx1-Fx11 working.

### Step 7: Remove social behavior from `auth-service`

After the dedicated service routes pass acceptance, remove social route mounting and unused social domain files from `auth-service`. It should retain:

- registration
- login
- current authenticated identity endpoint
- JWT signing/verification support

It should not own posts, likes, comments, replies, follows, feed, or profiles.

**Verify**:

- `rg -n "postRoutes|feedRoutes|likePost|followUser|Post|Like|Follow" auth-service/src` -> no matches except test fixtures or explicit docs/comments that explain external service calls.
- `npm test` -> all unit tests pass.
- `npm run test:acceptance` -> required feature summary is `11/11 features work`.

### Step 8: Update docs and OpenAPI to match the real deployment

Update setup docs to reflect the microservice architecture:

- `README.md` must describe gateway port `3000`, service ports, and Docker Compose startup.
- `docs/tooling.md` must no longer say dependencies are not installed if they are installed.
- `swagger/openapi.json` must match actual gateway paths.
- Mention that each service and MongoDB run in separate containers.

**Verify**:

- `docker compose config` -> exit 0.
- `npm run lint` -> exit 0.
- `npm run test:acceptance` -> exit 0.

## Test plan

Use the existing acceptance suite as the primary behavioral contract:

- `auth-service/src/tests/breezy.acceptance.test.js` currently covers Fx1-Fx11.
- Refactor its helper so tests hit the gateway/public route contract.
- Keep or add service-local tests next to each service:
  - post routes in `post-service/src/tests/`
  - comment/reply routes in `comment-service/src/tests/`
  - follow routes in `follow-service/src/tests/` or the chosen owner
  - feed routes in `feed-service/src/tests/`
  - profile routes in `profile-service/src/tests/` or the chosen owner

Required coverage:

- Happy paths for each required feature.
- Validation failures for body and path params.
- Unauthorized access for authenticated mutations.
- No email/password leakage in public profile/follow responses.
- Gateway-level route coverage for `/api/v1/posts`, `/api/v1/comments`, `/api/v1/users`, `/api/v1/feed`, and `/api/v1/profiles`.

## Done criteria

All must hold:

- [ ] `npm test` exits 0.
- [ ] `npm run lint` exits 0.
- [ ] `npm run test:acceptance` exits 0 and reports `11/11 features work` for required features.
- [ ] `docker compose config` exits 0.
- [ ] Gateway routes public `/api/v1` paths to the real owning services, not placeholders.
- [ ] `auth-service/src/app.js` mounts only auth/identity routes.
- [ ] Post/like behavior lives in `post-service`.
- [ ] Comment/reply behavior lives in `comment-service` and uses `/api/v1`.
- [ ] Follow behavior no longer lives under `/api/v1/auth`.
- [ ] Feed behavior lives in `feed-service` and uses an explicit post/follow contract.
- [ ] Profile endpoints required by Fx4/Fx10/Fx11 exist outside auth-service.
- [ ] Public follower/profile responses do not include `email` or `passwordHash`.
- [ ] `README.md`, `docs/tooling.md`, and `swagger/openapi.json` describe the same architecture that Docker Compose starts.
- [ ] No files outside the in-scope list are modified unless the executor stopped and got approval.
- [ ] `plans/README.md` status row for this plan is updated.

## STOP conditions

Stop and report back instead of improvising if:

- The project owner says any service boundary above is wrong.
- The code has drifted from the current-state excerpts and the intended owner of a domain is no longer clear.
- Passing acceptance requires changing the public API away from `/api/v1` OpenAPI paths.
- A step requires introducing a new database technology, message broker, API gateway product, or frontend work.
- A step's verification fails twice after a reasonable fix attempt.
- You need to expose secrets, commit `.env`, or hard-code production credentials.

## Maintenance notes

This plan is intentionally broad because the current architecture is split between a microservice shell and monolithic feature placement. Reviewers should scrutinize service ownership more than file movement: each route should have one clear owner, and auth-service should not regain social-network domain logic after this migration.

After this lands, create smaller follow-up plans for production hardening: environment validation, per-service CI matrices, dependency audit cleanup, API gateway smoke tests in Docker Compose, and eventual service-to-service authentication if services become independently deployable.

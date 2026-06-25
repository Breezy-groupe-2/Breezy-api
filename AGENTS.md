# AGENTS.md

## Project Context

- Breezy is a lightweight, responsive social network inspired by Twitter/X and optimized for low-resource environments.
- This repository is for the Breezy API/back-end work unless a later directory structure clearly introduces other apps.
- The course brief expects a distributed-app mindset with separable responsibilities. Prefer clear service/module boundaries over a large tangled API.

## Fixed Project Requirements

- Treat the project brief as the source of truth. Requirements explicitly specified there are not open design questions.
- Required features: account creation and validation, secure authentication, short posts, profile post message display, chronological feed from followed users, likes, comments on posts, replies to comments, follows/followers, basic user profiles, and the list of a user's published posts.
- Required back-end direction: Node.js, Express, RESTful APIs, JWT authentication, error handling, CORS handling, Docker, and the database technologies identified in the brief.
- Required front-end direction, when front-end work is in scope: React/Next.js, Tailwind CSS, Axios, mobile-first responsive UI, UI error handling, JWT storage, and post-authentication redirects.
- Required deliverables include a report covering goals, architecture, task/feature prioritization, project steps/resources, methodology, wireframes/mockups, principal feature implementation, and possible improvements.
- Optional features should stay behind explicit scope decisions: tags, tag search, notifications, private messages, media uploads, moderation reports/bans, multilingual UI, and user themes.

## Expected Stack

- Back-end: JavaScript, Node.js 22 LTS, Express, RESTful APIs, JWT authentication, Docker.
- Data layer for the first prototype: MongoDB with Mongoose.
- Keep the API service and MongoDB in separate containers. Do not build a Docker image that embeds both the service and the database.
- Front-end references from the brief are React, Next.js, Tailwind CSS, Axios, and mobile-first design; keep this repository API-focused unless front-end folders are added intentionally.
- When adding tooling, prefer standard `npm` scripts first so setup, tests, linting, and local development are discoverable from `package.json`.
- Use Zod for request validation and environment variable validation.
- Use Vitest for automated tests and Supertest for Express endpoint tests.
- Use ESLint for code-quality checks and Prettier for formatting.
- Use Swagger/OpenAPI for API documentation. Postman or Insomnia collections may be added later for manual testing demos.
- Use Docker Compose for local portability when container orchestration is needed.
- Prepare the service to sit behind an API Gateway or Nginx load balancer, but do not add those layers until the exercise or project step needs them.

## API Design

- Design endpoints around resources: users, sessions/auth, posts, comments, likes, follows, feeds, and profiles.
- Target Richardson REST maturity level 2: resource-oriented URLs, HTTP verbs, and meaningful HTTP status codes.
- Keep controllers thin. Put business rules in services/use-cases and persistence details in repositories/models.
- Validate request bodies, params, and query strings with Zod at the API boundary before hitting business logic.
- Return consistent JSON envelopes and HTTP status codes. Avoid leaking stack traces or database internals in responses.
- Treat feed, follow, like, and comment operations as authorization-sensitive; tests should cover ownership and role checks.

## Project Structure

- Use a distributed microservices architecture with separate service directories.
- Each service is a standalone npm package with its own `package.json`, `Dockerfile`, and `src/` tree.
- Keep app bootstrap and cross-cutting infrastructure separate from feature code within each service.

### Service Layout

```text
breezy-api/
  auth-service/          # Authentication, users, moderation (port 3001)
  post-service/          # Posts, likes, media uploads (port 3002)
  comment-service/       # Comments, replies, comment likes (port 3003)
  feed-service/          # Chronological feed (port 3004)
  follow-service/        # Follow/unfollow relationships (port 3006)
  swagger-service/       # API documentation aggregator (port 3005)
  api-gateway/           # Nginx reverse proxy (port 3000)
```

### Per-Service Internal Structure

```text
<service>/
  src/
    app.js               # Express app setup and route mounting
    server.js            # HTTP server startup
    config/
      env.js             # Zod environment validation
      database.js        # MongoDB connection
      swagger.js         # OpenAPI spec (optional)
    controllers/         # Thin request/response handlers
    middlewares/          # authenticate, validate, checkActive, etc.
    models/              # Mongoose schemas
    routes/              # Express Router definitions
    services/            # Business logic
    tests/               # Vitest + Supertest tests
```

### Docker Container Grouping

Services are grouped into Docker containers:
- `auth-profile-service` container: auth-service (port 3001)
- `comment-feed-follow-service` container: comment-service (3003), feed-service (3004), follow-service (3006)
- `post-service` container: post-service (port 3002)
- `swagger-service` container: swagger-service (port 3005)
- `api-gateway` container: nginx reverse proxy (port 3000)

### Validation

- Use Zod for request validation in `middlewares/validate.js` files.
- Use Zod for environment variable validation in `config/env.js` files.

## Git Workflow

- Use Git Flow:
  - `main` contains stable submitted/releasable work.
  - `dev` contains integrated ongoing work.
  - `feature/*` branches contain individual features or tasks.
  - `release/*` branches prepare project milestones.
  - `hotfix/*` branches fix urgent issues from `main`.
- Feature pull requests target `dev`; `dev` is merged into `main` only for stable delivery checkpoints.
- Prefer squash merges for feature pull requests and keep each pull request focused on one issue or one small feature slice.
- Use Conventional Commits for commit messages: `<type>(<scope>): <description>`.
- Use Commitizen to guide commit message creation.
- Use Commitlint with Husky to enforce Conventional Commit messages.
- At first, keep Husky limited to commit message validation; do not run the full test suite automatically on every commit unless the team chooses that later.
- Prefer these types: `feat`, `fix`, `docs`, `test`, `refactor`, `chore`, `build`, and `ci`.
- Example: `feat(posts): add post creation endpoint`.

## Security And Data

- Never commit secrets, tokens, database dumps, or local `.env` files.
- Store passwords only as salted hashes. Never log passwords or JWTs.
- Use short-lived access tokens when practical and keep refresh/session behavior explicit.
- Apply CORS deliberately; avoid permissive defaults in production-facing code.
- Add indexes or query-shape notes for timeline/feed queries when they become non-trivial.

## Development Workflow

- Before editing, inspect the existing structure and follow the conventions already present.
- Keep changes narrowly scoped to the requested feature or fix.
- Use `rg`/`rg --files` for code search.
- Use `apply_patch` for manual edits. Generated output and formatter rewrites may use the appropriate tool.
- Do not revert or overwrite user changes unless explicitly asked.
- If introducing new dependencies, choose small, maintained packages and explain why they are needed.

## Verification

- Run the most specific available checks after changes.
- If `package.json` exists, prefer scripts in this order when relevant: `npm test`, `npm run lint`, `npm run build`.
- If no verification command exists yet, state that clearly and add focused tests when the change creates behavior worth protecting.
- For API changes, include request/response coverage for happy paths, validation failures, and unauthorized access.
- For Docker or environment changes, verify local startup with the documented compose or npm command when available.

## Documentation

- Write repository code, comments, API docs, and Markdown documentation in English unless a course deliverable explicitly needs French.
- Keep project setup notes in `docs/tooling.md`.
- Keep Git Flow and Conventional Commit guidance in `docs/git-workflow.md`.
- Keep REST conventions and API response guidance in `docs/api-conventions.md`.
- Keep `README.md` updated with setup, environment variables, local run commands, and API overview as soon as those details exist.
- Document architectural decisions that affect service boundaries, database choice, authentication/session behavior, or deployment.
- Keep examples realistic for Breezy's social-network domain.

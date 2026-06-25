# Tooling

This project uses a small JavaScript-first toolchain for the Breezy API prototype.

## Runtime

- Node.js 22 LTS
- npm

Use the version in `.nvmrc`:

```bash
nvm use
```

## Planned Application Stack

- Express for the REST API
- MongoDB for persistence
- Mongoose as the ODM
- Zod for request and environment validation
- Docker Compose for local portability

## Canonical Runtime

Docker Compose plus the Nginx API gateway is the canonical local runtime. Compose starts the gateway on host port `3000` and keeps service containers behind it on the Compose network. Validate topology without starting containers with:

```bash
docker compose config --quiet
```

Run the real gateway smoke path with:

```bash
npm run test:gateway-smoke
```

The smoke script requires Docker daemon access. If `/var/run/docker.sock` is denied, local gateway smoke remains blocked; do not report it as passed until Docker permissions allow the script to start, test, and clean up the Compose project.

The canonical Compose default remains gateway host port `3000`. The smoke harness sets `API_GATEWAY_PORT` to an alternate host port by default so it can run while another local process already owns port `3000`.

## Feed Service Staged Batch Contract

`feed-service` connects to the same MongoDB database as `auth-service`
(`auth-db`) and reads the `Follow` and `User` collections. It owns the
`GET /api/v1/feed` endpoint. Feed-service must never create posts, likes,
users, or follows — it is read-only on those collections.

Feed assembly uses the staged batched lookup design: feed-service reads the authenticated user's followed accounts, then calls post-service once with a batched author query for the followed user IDs. This plan does not implement a persisted feed read model, event bus, cache, queue, or background fan-out worker.

`follow-service` also connects to `auth-db` and writes the `Follow` collection
and the legacy `User.following` array.

## Quality Tools

- ESLint checks JavaScript code quality.
- Prettier formats code and Markdown.
- Vitest runs automated tests.
- Supertest tests Express endpoints.

Common scripts:

```bash
npm run lint
npm run format:check
npm test
```

Install dependencies from the committed lockfile with `npm ci` before running checks locally.

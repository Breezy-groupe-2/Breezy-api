# Breezy API

Breezy API is the back-end prototype for Breezy, a lightweight social network inspired by Twitter/X.

This repository contains the Breezy API microservice prototype.

## Runtime Configuration

Breezy's canonical local runtime is Docker Compose. Compose starts the Nginx API gateway on host port `3000`; the service containers run behind that gateway on the Compose network.

Copy `.env.example` to `.env` for local development:

```bash
cp .env.example .env
```

Required variables:

- `NODE_ENV`: runtime environment
- `PORT`: service-specific HTTP port, set by Docker Compose for each container
- `MONGODB_URI`: MongoDB connection string
- `JWT_SECRET`: secret used to sign JWTs
- `INTERNAL_SERVICE_TOKEN`: shared service-to-service token for protected internal sync routes

Set `NODE_ENV=development` explicitly for local development. `NODE_ENV` has no default, so an omitted value stops every service before startup rather than enabling development credentials.

Generate independent local credentials rather than committing them:

```bash
openssl rand -hex 16  # Mongo root username
openssl rand -hex 32  # Mongo root password
openssl rand -hex 32  # JWT signing secret
```

Set `MONGO_ROOT_USER`, `MONGO_ROOT_PASSWORD`, and `JWT_SECRET` in `.env`. Build each Mongo URI from those values, URL-encoding the username and password when necessary, and set:

- `MONGODB_URI` for auth-service
- `POST_SERVICE_MONGODB_URI` for post-service
- `COMMENT_SERVICE_MONGODB_URI` for comment-service
- `FOLLOW_SERVICE_MONGODB_URI` for follow-service
- `FEED_SERVICE_MONGODB_URI` for feed-service

Each service validates `NODE_ENV`, `PORT`, `JWT_SECRET`, service-to-service credentials, and its database URI before startup. Production startup fails when credentials are absent, too short, malformed, or recognizable placeholders.

> Security notice: if any environment ever used repository-provided JWT or Mongo administrative defaults, rotate both credentials in that environment immediately and invalidate all outstanding access tokens. Removing defaults from Git does not rotate deployed credentials.

## Docker

The local MongoDB databases, service containers, and Nginx gateway are defined in Docker Compose.

Start the gateway-backed stack:

```bash
docker compose up --build
```

Open the API through the gateway at `http://localhost:3000`. Run `docker compose config --quiet` to validate the topology without starting containers.

The gateway smoke script exercises representative routes through Nginx. It keeps the canonical Compose default at port `3000`, but the smoke run maps the gateway to an alternate host port with `API_GATEWAY_PORT` when local port `3000` is already occupied.

```bash
npm run test:gateway-smoke
```

Local gateway smoke requires access to the Docker daemon. In environments where `/var/run/docker.sock` is not accessible, the script cannot start or clean up containers; use `docker compose config --quiet`, `npm test`, and `npm run lint` as the available non-Docker checks until Docker socket permission is restored.

Compose uses required interpolation for credentials and exits before startup when one is missing.

## Tooling Decisions

- JavaScript
- Node.js 22 LTS
- npm
- Express
- MongoDB
- Mongoose
- Zod
- Vitest
- Supertest
- ESLint
- Prettier
- Swagger/OpenAPI
- Docker Compose
- Git Flow
- Conventional Commits
- Commitizen
- Commitlint
- Husky

## Documentation

- [Tooling](docs/tooling.md)
- [Git workflow](docs/git-workflow.md)
- [API conventions](docs/api-conventions.md)

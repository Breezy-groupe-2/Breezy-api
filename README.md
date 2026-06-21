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

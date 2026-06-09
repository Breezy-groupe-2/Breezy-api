# Breezy API

Breezy API is the back-end prototype for Breezy, a lightweight social network inspired by Twitter/X.

This repository contains the Breezy API Express application scaffold.

## Runtime Configuration

The API is expected to run on port `4000`.

Copy `.env.example` to `.env` for local development:

```bash
cp .env.example .env
```

Required variables:

- `NODE_ENV`: runtime environment
- `PORT`: HTTP port, default `4000`
- `MONGODB_URI`: MongoDB connection string
- `JWT_SECRET`: secret used to sign JWTs

## Docker

The API image and local MongoDB service are defined for local development.

Build the API image:

```bash
docker build -t breezy-api .
```

Start the API and MongoDB stack:

```bash
docker compose up --build
```

The API container starts `src/server.js`.

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

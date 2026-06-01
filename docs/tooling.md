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

Dependencies are not installed yet. When the project is ready to scaffold the API, install the runtime and development packages in one deliberate setup step.

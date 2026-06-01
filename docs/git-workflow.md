# Git Workflow

This project follows Git Flow and Conventional Commits.

## Branches

- `main`: stable submitted or releasable work.
- `develop`: integrated ongoing work.
- `feature/*`: individual tasks or features.
- `release/*`: milestone stabilization.
- `hotfix/*`: urgent fixes from `main`.

Examples:

```text
feature/posts-crud
feature/docker-compose
feature/error-handling
release/prototype-1
```

## Commit Messages

Use Conventional Commits:

```text
<type>(<scope>): <description>
```

Examples:

```text
feat(posts): add post creation endpoint
fix(posts): return 404 when post does not exist
docs(readme): add local setup instructions
test(posts): cover post deletion
chore(tooling): configure eslint and prettier
```

Preferred types:

- `feat`: a new feature
- `fix`: a bug fix
- `docs`: documentation only
- `test`: tests
- `refactor`: code change without behavior change
- `chore`: maintenance or tooling
- `build`: build system or dependencies
- `ci`: continuous integration

Use Commitizen when committing:

```bash
npm run commit
```

Commitlint and Husky will enforce the Conventional Commit format once dependencies are installed and Husky hooks are initialized.

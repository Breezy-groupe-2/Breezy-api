# Git Workflow

This project follows Git Flow and Conventional Commits.

## Branches

- `main`: stable submitted or releasable work.
- `dev`: integrated ongoing work.
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

## Pull Requests

- Create feature branches from `dev`.
- Open feature pull requests into `dev`.
- Keep pull requests focused on one issue or one small feature slice.
- Reference the issue in the pull request description with `Closes #123` when the PR fully completes it, or `Refs #123` when it only contributes part of the work.
- Ask at least one teammate to review before merging.
- Back-end pull requests should run lint and tests before review when the scripts exist.
- Documentation-only pull requests can be reviewed by the project manager.

## Merge Rules

- Use squash merge for feature pull requests so `dev` stays readable.
- Do not merge a pull request with unresolved review comments.
- Do not merge broken lint, test, or build checks once CI is configured.
- Merge `dev` into `main` only for stable delivery checkpoints, sprint demos, or final submission.
- Use `release/*` branches only when the team needs a stabilization branch before merging into `main`.

## Naming

- Use branch names that include the domain and issue number when possible:

```text
feature/auth-21-login-endpoint
feature/feed-46-chronological-feed
docs/78-feature-prioritization
chore/4-api-ci
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

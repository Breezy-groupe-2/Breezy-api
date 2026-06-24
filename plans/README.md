# Breezy API Implementation Plans

## Priority Order

| # | Plan | Impact | Effort | Risk | Status |
|---|------|--------|--------|------|--------|
| 001 | Remove hardcoded credentials | Critical | Low | Low | Pending |
| 002 | Restrict CORS wildcard | Critical | Low | Low | Pending |
| 003 | Add Helmet security headers | High | Low | Low | Pending |
| 004 | Add rate limiting to auth endpoints | Critical | Medium | Low | Pending |
| 005 | Run Docker containers as non-root | High | Medium | Medium | Pending |
| 006 | Sanitize error handlers | High | Low | Low | Pending |
| 007 | Add structured logging | Medium | Medium | Low | Pending |
| 008 | Add graceful shutdown | Medium | Low | Low | Pending |
| 009 | Consolidate authenticate middleware | Medium | High | Medium | Pending |
| 010 | Add API pagination | Low | High | Low | Pending |

## Dependency Graph

```
001 (credentials) ─┐
002 (CORS) ────────┤
003 (Helmet) ──────┼──> 008 (graceful shutdown)
004 (rate limit) ──┤
005 (non-root) ────┤
006 (errors) ──────┤
007 (logging) ─────┘
                    │
009 (middleware) ───┤
010 (pagination) ───┘
```

## Execution Waves

### Wave 1 (Parallel - No Dependencies)
- 001: Remove hardcoded credentials
- 002: Restrict CORS wildcard
- 003: Add Helmet security headers
- 004: Add rate limiting to auth endpoints
- 005: Run Docker containers as non-root
- 006: Sanitize error handlers
- 007: Add structured logging

### Wave 2 (After Wave 1)
- 008: Add graceful shutdown
- 009: Consolidate authenticate middleware
- 010: Add API pagination

## Commit Strategy

Each plan will be implemented as a separate PR with conventional commits:
- `fix(security): remove hardcoded credentials`
- `fix(security): restrict CORS to frontend origin`
- `fix(security): add Helmet security headers`
- `fix(security): add rate limiting to auth endpoints`
- `fix(security): run Docker containers as non-root`
- `fix(security): sanitize error handlers`
- `feat(logging): add structured logging with pino`
- `fix(server): add graceful shutdown handlers`
- `refactor(middleware): consolidate authenticate middleware`
- `feat(api): add cursor-based pagination`

## Verification

After each PR:
1. `npm run lint` passes
2. `npm test` passes
3. `npm run test:acceptance` passes
4. Docker build succeeds
5. Manual verification of the specific fix

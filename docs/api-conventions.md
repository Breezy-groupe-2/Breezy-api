# API Conventions

The API should target Richardson REST maturity level 2.

## Routes

Use resource-oriented URLs and HTTP verbs:

```text
GET    /api/v1/posts
GET    /api/v1/posts/:id
POST   /api/v1/posts
PUT    /api/v1/posts/:id
DELETE /api/v1/posts/:id
```

## Status Codes

Use meaningful HTTP status codes:

- `200 OK` for successful reads and updates.
- `201 Created` for successful creation.
- `204 No Content` for successful deletion without a response body.
- `400 Bad Request` for invalid input.
- `401 Unauthorized` for missing or invalid authentication.
- `403 Forbidden` for authenticated users without permission.
- `404 Not Found` for missing resources.
- `500 Internal Server Error` for unexpected failures.

## Validation

Validate request bodies, route params, query strings, and environment variables with Zod before business logic runs.

## Errors

Return consistent JSON errors. Do not expose stack traces, secrets, database internals, or raw dependency errors in API responses.

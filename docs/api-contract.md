# Breezy API Contract

This document describes the public HTTP contract exposed by the Breezy API gateway. It covers resource URLs, request/response payloads, authentication requirements, and HTTP status codes.

## Base URL

The canonical local entry point is the Nginx API gateway:

```text
http://localhost:3000/api/v1
```

All endpoints below are relative to this base URL. Individual services also expose their own ports for direct access, but gateway routing is the intended public surface.

## Authentication

Most write operations and personal endpoints require a valid JWT access token in the `Authorization` header:

```text
Authorization: Bearer <jwt>
```

Tokens are issued by `POST /auth/register` and `POST /auth/login`. Requests with a missing, malformed, expired, or invalid token receive `401 Unauthorized`. Requests from suspended, banned, or deactivated users receive `403 Forbidden`.

## Common Error Format

Validation and business errors return a consistent JSON envelope:

```json
{
  "error": "Validation failed",
  "details": [{ "field": "email", "message": "Invalid email address" }]
}
```

Simple errors may omit the `details` array:

```json
{
  "error": "Post not found"
}
```

Stack traces, database internals, and secrets are never returned.

## Common Models

### User (authentication view)

```json
{
  "id": "651a2b3c4d5e6f7a8b9c0d1e",
  "username": "janedoe",
  "email": "jane@example.com",
  "role": "user",
  "preferences": {
    "theme": { "mode": "dark", "accentColor": "#1DA1F2" }
  }
}
```

### Public Profile

```json
{
  "id": "651a2b3c4d5e6f7a8b9c0d1e",
  "username": "janedoe",
  "bio": "Explorer of the digital frontier.",
  "avatarUrl": "https://example.com/jane.png"
}
```

### Post

```json
{
  "id": "651a3c4d5e6f7a8b9c0d1e2f",
  "content": "This is a post on Breezy!",
  "authorId": "651a2b3c4d5e6f7a8b9c0d1e",
  "likeCount": 5,
  "createdAt": "2026-06-12T13:00:00.000Z"
}
```

### Comment

```json
{
  "id": "651a4d5e6f7a8b9c0d1e2f3a",
  "postId": "651a3c4d5e6f7a8b9c0d1e2f",
  "content": "Great post!",
  "authorId": "651a2b3c4d5e6f7a8b9c0d1e",
  "createdAt": "2026-06-12T13:05:00.000Z",
  "replies": []
}
```

### Reply

```json
{
  "id": "651a5e6f7a8b9c0d1e2f3a4b",
  "parentCommentId": "651a4d5e6f7a8b9c0d1e2f3a",
  "content": "Agreed!",
  "authorId": "651a3b4c5d6e7f8a9b0c1d2e",
  "createdAt": "2026-06-12T13:06:00.000Z"
}
```

### User Summary

```json
{
  "id": "651a2b3c4d5e6f7a8b9c0d1e",
  "username": "follower_user"
}
```

---

## Authentication

### Register

```text
POST /auth/register
```

Creates a new user account and returns a JWT.

**Request body:**

```json
{
  "username": "janedoe",
  "email": "jane@example.com",
  "password": "SecurePassword123"
}
```

Validation:

- `username`: 3–50 characters, letters, numbers, and underscores only.
- `email`: valid email format.
- `password`: 8–128 characters.

**Responses:**

- `201 Created` — account created, returns token and user.
- `400 Bad Request` — validation failed.
- `409 Conflict` — username or email already exists.

### Login

```text
POST /auth/login
```

Authenticates an existing user and returns a JWT.

**Request body:**

```json
{
  "email": "jane@example.com",
  "password": "SecurePassword123"
}
```

**Responses:**

- `200 OK` — authentication successful, returns token and user.
- `401 Unauthorized` — invalid credentials.
- `403 Forbidden` — account is suspended or deactivated.

### Current User

```text
GET /auth/me
```

Returns the authenticated user's account details.

**Auth:** required.

**Responses:**

- `200 OK` — returns the [User](#user-authentication-view) object.
- `401 Unauthorized` — missing or invalid token.
- `403 Forbidden` — account is suspended.

---

## Users

### Get Public Profile

```text
GET /users/:id
```

Returns the public profile for a user.

**Auth:** none.

**Responses:**

- `200 OK` — returns a [Public Profile](#public-profile).
- `404 Not Found` — user profile not found.

### Get Current User Profile

```text
GET /users/me
```

Returns the public profile for the authenticated user.

**Auth:** required.

**Responses:**

- `200 OK` — returns a [Public Profile](#public-profile).
- `401 Unauthorized` — missing or invalid token.

### Update Current User Profile

```text
PUT /users/me
```

Updates the authenticated user's public profile.

**Auth:** required.

**Request body:**

```json
{
  "bio": "Updated bio text.",
  "avatarUrl": "https://example.com/jane-new.png"
}
```

Validation:

- `bio`: optional, max 160 characters.
- `avatarUrl`: optional, must be a valid URL.

**Responses:**

- `200 OK` — returns the updated [Public Profile](#public-profile).
- `400 Bad Request` — validation failed.
- `401 Unauthorized` — missing or invalid token.

### Update Preferences

```text
PATCH /users/me/preferences
```

Updates the authenticated user's theme preferences.

**Auth:** required.

**Request body:**

```json
{
  "theme": {
    "mode": "dark",
    "accentColor": "#1DA1F2"
  }
}
```

Validation:

- `theme.mode`: required, `"light"` or `"dark"`.
- `theme.accentColor`: required, `#RRGGBB` hex color.

**Responses:**

- `200 OK` — returns the updated preferences.
- `400 Bad Request` — validation failed.
- `401 Unauthorized` — missing or invalid token.

### Moderate User

```text
PATCH /users/:id/moderation
```

Changes a user's moderation status. Restricted to moderators and admins.

**Auth:** required, moderator or admin role.

**Request body:**

```json
{
  "status": "suspended",
  "durationHours": 24,
  "reason": "Violation of community rules"
}
```

Validation:

- `status`: required, `"active"`, `"suspended"`, or `"banned"`.
- `durationHours`: optional integer for temporary suspensions.
- `reason`: required, non-empty string.

**Responses:**

- `200 OK` — moderation applied.
- `403 Forbidden` — caller lacks moderator role.
- `404 Not Found` — target user not found.

---

## Posts

### Publish Post

```text
POST /posts
```

Publishes a short text post.

**Auth:** required, active user.

**Request body:**

```json
{
  "content": "This is a post on Breezy!"
}
```

Validation:

- `content`: required, trimmed, 1–280 characters.

**Responses:**

- `201 Created` — returns the created [Post](#post).
- `400 Bad Request` — validation failed.
- `401 Unauthorized` — missing or invalid token.
- `403 Forbidden` — suspended or banned user.

### List Own Posts

```text
GET /posts/me
```

Returns all posts published by the authenticated user.

**Auth:** required.

**Responses:**

- `200 OK` — array of [Post](#post) objects.
- `401 Unauthorized` — missing or invalid token.

### List Posts by User

```text
GET /posts/user/:userId
```

Returns all posts published by a specific user.

**Auth:** none.

**Responses:**

- `200 OK` — array of [Post](#post) objects.
- `404 Not Found` — user not found.

### List Posts by Authors

```text
GET /posts?authorIds=:commaSeparatedIds&limit=:number
```

Returns posts from a specific set of authors, newest first.

**Auth:** none.

**Query parameters:**

- `authorIds`: required, comma-separated list of user IDs (max 100). May be empty.
- `limit`: optional, integer 1–100, default `20`.

**Responses:**

- `200 OK` — array of [Post](#post) objects.
- `400 Bad Request` — missing or invalid `authorIds`, or `limit` out of range.

### Update Post

```text
PUT /posts/:id
```

Edits an existing post. Only the original author may update it.

**Auth:** required.

**Request body:** same as [Publish Post](#publish-post).

**Responses:**

- `200 OK` — returns the updated [Post](#post).
- `400 Bad Request` — validation failed.
- `401 Unauthorized` — missing or invalid token.
- `403 Forbidden` — caller is not the author.
- `404 Not Found` — post not found.

### Like Post

```text
POST /posts/:id/like
```

Likes a post.

**Auth:** required.

**Responses:**

- `200 OK` — returns `{ id, likeCount }`.
- `400 Bad Request` — invalid post ID.
- `401 Unauthorized` — missing or invalid token.
- `404 Not Found` — post not found.
- `409 Conflict` — post already liked by this user.

### Unlike Post

```text
DELETE /posts/:id/like
```

Removes a like from a post.

**Auth:** required.

**Responses:**

- `200 OK` — returns `{ id, likeCount }`.
- `400 Bad Request` — invalid post ID.
- `401 Unauthorized` — missing or invalid token.
- `404 Not Found` — post not found.

---

## Comments

### Comment on Post

```text
POST /posts/:postId/comments
```

Adds a comment to a post.

**Auth:** required.

**Request body:**

```json
{
  "content": "Great post!"
}
```

Validation:

- `content`: required, trimmed, 1–280 characters.

**Responses:**

- `201 Created` — returns the created [Comment](#comment).
- `400 Bad Request` — validation failed or invalid ID format.
- `401 Unauthorized` — missing or invalid token.
- `404 Not Found` — post not found.

### List Post Comments

```text
GET /posts/:postId/comments
```

Returns comments for a post in chronological order.

**Auth:** none.

**Responses:**

- `200 OK` — array of [Comment](#comment) objects.
- `400 Bad Request` — invalid ID format.

### Reply to Comment

```text
POST /comments/:commentId/replies
```

Adds a reply to an existing comment.

**Auth:** required.

**Request body:** same as [Comment on Post](#comment-on-post).

**Responses:**

- `201 Created` — returns the created [Reply](#reply).
- `400 Bad Request` — validation failed or invalid ID format.
- `401 Unauthorized` — missing or invalid token.
- `404 Not Found` — parent comment not found.

### List Comment Replies

```text
GET /comments/:commentId/replies
```

Returns replies for a comment in chronological order.

**Auth:** none.

**Responses:**

- `200 OK` — array of [Reply](#reply) objects.
- `400 Bad Request` — invalid ID format.

---

## Follows

### Follow User

```text
POST /users/:id/follow
```

Creates a follow relationship from the authenticated user to the target user.

**Auth:** required.

**Responses:**

- `200 OK` — follow created.
- `400 Bad Request` — cannot follow yourself or invalid ID.
- `401 Unauthorized` — missing or invalid token.
- `404 Not Found` — target user not found.
- `409 Conflict` — already following this user.

### Unfollow User

```text
DELETE /users/:id/follow
```

Removes a follow relationship.

**Auth:** required.

**Responses:**

- `200 OK` — follow removed.
- `401 Unauthorized` — missing or invalid token.
- `404 Not Found` — user not found.

### List Followers

```text
GET /users/:id/followers
```

Returns the followers of a user.

**Auth:** required.

**Responses:**

- `200 OK` — array of [User Summary](#user-summary) objects.
- `401 Unauthorized` — missing or invalid token.

### List Following

```text
GET /users/:id/following
```

Returns the users a user is following.

**Auth:** required.

**Responses:**

- `200 OK` — array of [User Summary](#user-summary) objects.
- `401 Unauthorized` — missing or invalid token.

---

## Feed

### Get Feed

```text
GET /feed?limit=:number
```

Returns a chronological feed of posts from users the authenticated user follows, newest first.

**Auth:** required.

**Query parameters:**

- `limit`: optional, integer 1–100, default `20`. Values outside the range are clamped.

**Responses:**

- `200 OK` — array of [Post](#post) objects.
- `401 Unauthorized` — missing or invalid token.

---

## Status Code Summary

| Code                        | Meaning                                                      |
| --------------------------- | ------------------------------------------------------------ |
| `200 OK`                    | Successful read or update.                                   |
| `201 Created`               | Successful creation.                                         |
| `400 Bad Request`           | Invalid input, validation failure, or malformed ID.          |
| `401 Unauthorized`          | Missing, malformed, invalid, or expired token.               |
| `403 Forbidden`             | Authenticated user lacks permission or is suspended/banned.  |
| `404 Not Found`             | Resource does not exist.                                     |
| `409 Conflict`              | Duplicate action (e.g., already liked or already following). |
| `500 Internal Server Error` | Unexpected server failure.                                   |

## Gateway Routes

The Nginx gateway maps public paths to internal services:

| Public Prefix                                          | Internal Service            | Port |
| ------------------------------------------------------ | --------------------------- | ---- |
| `/api/v1/auth`                                         | auth-profile-service        | 3001 |
| `/api/v1/users` (auth, profiles, moderation)           | auth-profile-service        | 3001 |
| `/api/v1/posts`                                        | post-service                | 3002 |
| `/api/v1/posts/:postId/comments`                       | comment-feed-follow-service | 3003 |
| `/api/v1/comments/:commentId/replies`                  | comment-feed-follow-service | 3003 |
| `/api/v1/users/:id/follow`, `/followers`, `/following` | comment-feed-follow-service | 3006 |
| `/api/v1/feed`                                         | comment-feed-follow-service | 3004 |
| `/api-docs`                                            | swagger-service             | 3005 |

> **Risk note:** `/internal/users/:id` is an unauthenticated service-to-service endpoint exposed only inside the Docker network. Do not publish port 3001 to untrusted networks.

See [`api-gateway/nginx.conf`](../api-gateway/nginx.conf) and [`docker-compose.yml`](../docker-compose.yml) for the full routing configuration.

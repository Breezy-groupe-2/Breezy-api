# Breezy DB Seeding Guide & Accounts

This document lists the seeded database accounts, their passwords, and explains how to run the seeder script.

## 🔑 Seed Accounts

All seeded accounts share the **same password**:

> **Password:** `password123`

| Username  | Email Address          | Role    | Status        | Description                                                      |
| :-------- | :--------------------- | :------ | :------------ | :--------------------------------------------------------------- |
| `alice`   | `alice@breezy.local`   | `admin` | Active        | Platform administrator (publishes guide rules).                  |
| `bob`     | `bob@breezy.local`     | `user`  | Active        | General user (publishes tech posts, comments on Alice's post).   |
| `charlie` | `charlie@breezy.local` | `user`  | Active        | General user (publishes design posts, comments on Alice's post). |
| `david`   | `david@breezy.local`   | `user`  | Active        | General user (does not have any posts or comments yet).          |
| `eve`     | `eve@breezy.local`     | `user`  | **Suspended** | User account flagged as suspended for testing moderation logic.  |

> **Local development only:** These accounts and credentials are for local development only. Never use them in production or any shared environment.

---

## 🚀 How to Run the Seeder

Follow these steps to populate the databases when working with Docker:

### Step 1: Start the Docker Containers

Before running the seeder, the MongoDB databases must be running. Start your Docker compose stack if it isn't already:

```bash
docker compose up -d
```

_(You can also use `npm run dev` to start in the foreground)._

### Step 2: Execute the Seed Command

Once the containers are up and running, execute the seed command on your host machine from the repository root:

```bash
npm run seed
```

This script will:

1. Connect to the databases using the exposed host ports (`27017` and `27018`).
2. Clear any old data in all databases.
3. Inject the mock accounts, follows, posts, likes, comments, and comment replies.

---

## 🔍 Inspected Database Ports

If you want to connect a database GUI client (like MongoDB Compass, Robo 3T, or VS Code MongoDB extension) to inspect the data on your host, use the following connection URIs:

- **Auth Database (`breezy_auth`)**:
  `mongodb://${MONGO_ROOT_USER}:${MONGO_ROOT_PASSWORD}@localhost:27017/breezy_auth?authSource=admin`
- **Unified DB Container (`breezy-post-follow-comment-db`)** exposed on localhost port `27018`:
  - **Posts Database**: `mongodb://${MONGO_ROOT_USER}:${MONGO_ROOT_PASSWORD}@localhost:27018/breezy_posts?authSource=admin`
  - **Comments Database**: `mongodb://${MONGO_ROOT_USER}:${MONGO_ROOT_PASSWORD}@localhost:27018/breezy_comments?authSource=admin`
  - **Follow Database**: `mongodb://${MONGO_ROOT_USER}:${MONGO_ROOT_PASSWORD}@localhost:27018/breezy_follows?authSource=admin`

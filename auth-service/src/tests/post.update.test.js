const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const request = require('supertest');
const User = require('../models/user.model');
const { app, models } = require('./helpers/api-test-utils');

const { Post } = models;

let mongod;
let token;
let otherToken;
let postId;

process.env.JWT_SECRET = 'test_secret';

const userPayload = { username: 'testuser', email: 'test@example.com', password: 'Password123' };
const otherPayload = { username: 'otheruser', email: 'other@example.com', password: 'Password123' };

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

beforeEach(async () => {
  await User.deleteMany({});
  await Post.deleteMany({});

  await request(app).post('/api/v1/auth/register').send(userPayload);
  const res = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: userPayload.email, password: userPayload.password });
  token = res.body.token;

  await request(app).post('/api/v1/auth/register').send(otherPayload);
  const res2 = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: otherPayload.email, password: otherPayload.password });
  otherToken = res2.body.token;

  const postRes = await request(app)
    .post('/api/v1/posts')
    .set('Authorization', `Bearer ${token}`)
    .send({ content: 'Original content' });
  postId = postRes.body.id;
});

describe('PUT /api/v1/posts/:id', () => {
  it('returns 200 and updated post when owner edits', async () => {
    const res = await request(app)
      .put(`/api/v1/posts/${postId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ content: 'Updated content' });

    expect(res.status).toBe(200);
    expect(res.body.content).toBe('Updated content');
  });

  it('returns 403 when another user tries to edit', async () => {
    const res = await request(app)
      .put(`/api/v1/posts/${postId}`)
      .set('Authorization', `Bearer ${otherToken}`)
      .send({ content: 'Hacked content' });

    expect(res.status).toBe(403);
  });

  it('returns 404 when post does not exist', async () => {
    const fakeId = new mongoose.Types.ObjectId();
    const res = await request(app)
      .put(`/api/v1/posts/${fakeId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ content: 'Updated content' });

    expect(res.status).toBe(404);
  });

  it('returns 400 when content exceeds 280 characters', async () => {
    const res = await request(app)
      .put(`/api/v1/posts/${postId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ content: 'a'.repeat(281) });

    expect(res.status).toBe(400);
  });

  it('returns 401 when no token is provided', async () => {
    const res = await request(app)
      .put(`/api/v1/posts/${postId}`)
      .send({ content: 'Updated content' });

    expect(res.status).toBe(401);
  });
});

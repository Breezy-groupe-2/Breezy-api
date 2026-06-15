const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const request = require('supertest');
const User = require('../models/user.model');
const { app, models } = require('./helpers/api-test-utils');

const { Post } = models;

let mongod;
let token;
let userId;

process.env.JWT_SECRET = 'test_secret';

const userPayload = { username: 'testuser', email: 'test@example.com', password: 'Password123' };

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
  userId = res.body.user.id;
});

describe('GET /api/v1/posts/user/:userId', () => {
  it('returns 200 and empty array when user has no posts', async () => {
    const res = await request(app).get(`/api/v1/posts/user/${userId}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('returns 200 and list of posts sorted by createdAt desc', async () => {
    await request(app)
      .post('/api/v1/posts')
      .set('Authorization', `Bearer ${token}`)
      .send({ content: 'First post' });
    await request(app)
      .post('/api/v1/posts')
      .set('Authorization', `Bearer ${token}`)
      .send({ content: 'Second post' });

    const res = await request(app).get(`/api/v1/posts/user/${userId}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0].content).toBe('Second post');
    expect(res.body[0]).toHaveProperty('likeCount', 0);
  });

  it('returns 404 for invalid user id', async () => {
    const res = await request(app).get('/api/v1/posts/user/notanid');

    expect(res.status).toBe(404);
  });
});

describe('GET /api/v1/posts/me', () => {
  it('returns 200 and own posts', async () => {
    await request(app)
      .post('/api/v1/posts')
      .set('Authorization', `Bearer ${token}`)
      .send({ content: 'My post' });

    const res = await request(app)
      .get('/api/v1/posts/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].content).toBe('My post');
  });

  it('returns 401 when not authenticated', async () => {
    const res = await request(app).get('/api/v1/posts/me');

    expect(res.status).toBe(401);
  });
});

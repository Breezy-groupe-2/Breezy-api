const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const User = require('../../../auth-service/src/models/user.model');
const { app, models } = require('../../../auth-service/src/tests/helpers/api-test-utils');

const { Post } = models;

let mongod;
let token;

process.env.JWT_SECRET = 'test_secret';

const userPayload = {
  username: 'testuser',
  email: 'test@example.com',
  password: 'Password123',
};

const originalFetch = global.fetch;

const mockActiveUser = () => {
  global.fetch = async () => ({
    ok: true,
    status: 200,
    json: async () => ({ isActive: true }),
  });
};

beforeAll(async () => {
  mockActiveUser();
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
});

afterAll(async () => {
  global.fetch = originalFetch;
  await mongoose.disconnect();
  await mongod.stop();
});

beforeEach(async () => {
  mockActiveUser();
  await User.deleteMany({});
  await Post.deleteMany({});
  await request(app).post('/api/v1/auth/register').send(userPayload);
  const res = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: userPayload.email, password: userPayload.password });
  token = res.body.token;
});

describe('POST /api/v1/posts', () => {
  it('returns 201 and post data on valid input', async () => {
    const res = await request(app)
      .post('/api/v1/posts')
      .set('Authorization', `Bearer ${token}`)
      .send({ content: 'Hello Breezy!' });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ content: 'Hello Breezy!' });
    expect(res.body).toHaveProperty('id');
    expect(res.body).toHaveProperty('createdAt');
  });

  it('returns 400 when content is empty', async () => {
    const res = await request(app)
      .post('/api/v1/posts')
      .set('Authorization', `Bearer ${token}`)
      .send({ content: '' });

    expect(res.status).toBe(400);
    expect(res.body.details[0].field).toBe('content');
  });

  it('returns 400 when content exceeds 280 characters', async () => {
    const res = await request(app)
      .post('/api/v1/posts')
      .set('Authorization', `Bearer ${token}`)
      .send({ content: 'a'.repeat(281) });

    expect(res.status).toBe(400);
    expect(res.body.details[0].field).toBe('content');
  });

  it('returns 400 when content is exactly 280 characters', async () => {
    const res = await request(app)
      .post('/api/v1/posts')
      .set('Authorization', `Bearer ${token}`)
      .send({ content: 'a'.repeat(280) });

    expect(res.status).toBe(201);
  });

  it('returns 401 when no token is provided', async () => {
    const res = await request(app).post('/api/v1/posts').send({ content: 'Hello Breezy!' });

    expect(res.status).toBe(401);
  });

  it('returns 401 on invalid token', async () => {
    const res = await request(app)
      .post('/api/v1/posts')
      .set('Authorization', 'Bearer invalidtoken')
      .send({ content: 'Hello Breezy!' });

    expect(res.status).toBe(401);
  });

  it('returns 401 on expired token', async () => {
    const expiredToken = jwt.sign({ sub: new mongoose.Types.ObjectId(), role: 'user' }, 'test_secret', {
      expiresIn: '-1s',
    });

    const res = await request(app)
      .post('/api/v1/posts')
      .set('Authorization', `Bearer ${expiredToken}`)
      .send({ content: 'Hello Breezy!' });

    expect(res.status).toBe(401);
  });

  it.each([403, 404])('returns %s from auth-service active verification', async (status) => {
    global.fetch = async () => ({ ok: false, status, json: async () => ({ error: 'auth failed' }) });

    const res = await request(app)
      .post('/api/v1/posts')
      .set('Authorization', `Bearer ${token}`)
      .send({ content: 'Hello Breezy!' });

    expect(res.status).toBe(status);
  });

  it.each([
    ['network rejection', async () => Promise.reject(new Error('network down'))],
    ['auth-service 5xx', async () => ({ ok: false, status: 503, json: async () => ({ error: 'down' }) })],
  ])('returns 502 when auth-service active verification has %s', async (_caseName, fetchImpl) => {
    global.fetch = fetchImpl;

    const res = await request(app)
      .post('/api/v1/posts')
      .set('Authorization', `Bearer ${token}`)
      .send({ content: 'Hello Breezy!' });

    expect(res.status).toBe(502);
  });
});

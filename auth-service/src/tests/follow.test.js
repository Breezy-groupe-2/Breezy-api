const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const request = require('supertest');
const app = require('../app');
const User = require('../models/user.model');
const Follow = require('../models/follow.model');

let mongod;
let tokenA, tokenB;
let userAId, userBId;

process.env.JWT_SECRET = 'test_secret';

const userA = { username: 'userA', email: 'a@example.com', password: 'Password123' };
const userB = { username: 'userB', email: 'b@example.com', password: 'Password123' };

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
  await Follow.deleteMany({});

  await request(app).post('/api/v1/auth/register').send(userA);
  const resA = await request(app).post('/api/v1/auth/login').send({ email: userA.email, password: userA.password });
  tokenA = resA.body.token;
  userAId = resA.body.user.id;

  await request(app).post('/api/v1/auth/register').send(userB);
  const resB = await request(app).post('/api/v1/auth/login').send({ email: userB.email, password: userB.password });
  tokenB = resB.body.token;
  userBId = resB.body.user.id;
});

describe('POST /api/v1/auth/:id/follow', () => {
  it('returns 200 when following another user', async () => {
    const res = await request(app)
      .post(`/api/v1/auth/${userBId}/follow`)
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(200);
  });

  it('returns 400 when trying to follow yourself', async () => {
    const res = await request(app)
      .post(`/api/v1/auth/${userAId}/follow`)
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(400);
  });

  it('returns 409 on duplicate follow', async () => {
    await request(app).post(`/api/v1/auth/${userBId}/follow`).set('Authorization', `Bearer ${tokenA}`);
    const res = await request(app).post(`/api/v1/auth/${userBId}/follow`).set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(409);
  });

  it('returns 401 when not authenticated', async () => {
    const res = await request(app).post(`/api/v1/auth/${userBId}/follow`);
    expect(res.status).toBe(401);
  });
});

describe('DELETE /api/v1/auth/:id/follow', () => {
  it('returns 200 after unfollowing', async () => {
    await request(app).post(`/api/v1/auth/${userBId}/follow`).set('Authorization', `Bearer ${tokenA}`);
    const res = await request(app).delete(`/api/v1/auth/${userBId}/follow`).set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(200);
  });
});

describe('GET /api/v1/auth/:id/followers', () => {
  it('returns followers list', async () => {
    await request(app).post(`/api/v1/auth/${userBId}/follow`).set('Authorization', `Bearer ${tokenA}`);
    const res = await request(app).get(`/api/v1/auth/${userBId}/followers`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].username).toBe('userA');
  });
});

describe('GET /api/v1/auth/:id/following', () => {
  it('returns following list', async () => {
    await request(app).post(`/api/v1/auth/${userBId}/follow`).set('Authorization', `Bearer ${tokenA}`);
    const res = await request(app).get(`/api/v1/auth/${userAId}/following`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].username).toBe('userB');
  });
});

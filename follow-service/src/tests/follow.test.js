const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const request = require('supertest');
const app = require('../app');
const Follow = require('../models/follow.model');
const User = require('../models/user.model');

process.env.JWT_SECRET = 'test_secret';

let mongod;
let tokenA;
let userA;
let userB;
const originalFetch = global.fetch;

const createUser = async (suffix, overrides = {}) =>
  User.create({
    username: `user${suffix}`,
    email: `user${suffix}@example.com`,
    passwordHash: await bcrypt.hash('Password123', 12),
    ...overrides,
  });

const tokenFor = (user) =>
  jwt.sign({ sub: user._id.toString(), role: user.role }, process.env.JWT_SECRET, {
    expiresIn: '15m',
  });

const mockActiveUser = () => {
  global.fetch = async () => ({ ok: true, status: 200, json: async () => ({}) });
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
  await Follow.deleteMany({});

  userA = await createUser('A');
  userB = await createUser('B');
  tokenA = tokenFor(userA);
});

describe('follow routes', () => {
  it('follows another user and maintains User.following without duplicates', async () => {
    const first = await request(app)
      .post(`/api/v1/users/${userB._id}/follow`)
      .set('Authorization', `Bearer ${tokenA}`);
    const storedUser = await User.findById(userA._id);
    const followCount = await Follow.countDocuments({ follower: userA._id, following: userB._id });

    expect(first.status).toBe(200);
    expect(first.body).toMatchObject({
      followerId: userA._id.toString(),
      followingId: userB._id.toString(),
    });
    expect(followCount).toBe(1);
    expect(storedUser.following.map((id) => id.toString())).toEqual([userB._id.toString()]);
  });

  it('rejects duplicate follows', async () => {
    await request(app)
      .post(`/api/v1/users/${userB._id}/follow`)
      .set('Authorization', `Bearer ${tokenA}`);

    const duplicate = await request(app)
      .post(`/api/v1/users/${userB._id}/follow`)
      .set('Authorization', `Bearer ${tokenA}`);

    expect(duplicate.status).toBe(409);
    expect(duplicate.body).toHaveProperty('error');
  });

  it('rejects self-follow', async () => {
    const res = await request(app)
      .post(`/api/v1/users/${userA._id}/follow`)
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('requires a valid token to follow', async () => {
    const res = await request(app).post(`/api/v1/users/${userB._id}/follow`);

    expect(res.status).toBe(401);
  });

  it('returns 401 for malformed tokens', async () => {
    const res = await request(app)
      .post(`/api/v1/users/${userB._id}/follow`)
      .set('Authorization', 'Bearer not-a-jwt');

    expect(res.status).toBe(401);
  });

  it('returns 401 for expired tokens', async () => {
    const expiredToken = jwt.sign({ sub: userA._id.toString(), role: userA.role }, process.env.JWT_SECRET, {
      expiresIn: '-1s',
    });

    const res = await request(app)
      .post(`/api/v1/users/${userB._id}/follow`)
      .set('Authorization', `Bearer ${expiredToken}`);

    expect(res.status).toBe(401);
  });

  it.each(['inactive', 'banned', 'suspended'])('returns 403 when auth-service marks user %s', async () => {
    global.fetch = async () => ({ ok: false, status: 403, json: async () => ({ error: 'Forbidden' }) });

    const res = await request(app)
      .post(`/api/v1/users/${userB._id}/follow`)
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(403);
  });

  it('returns 404 when auth-service cannot find the authenticated user', async () => {
    global.fetch = async () => ({ ok: false, status: 404, json: async () => ({ error: 'User not found' }) });

    const res = await request(app)
      .post(`/api/v1/users/${userB._id}/follow`)
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(404);
  });

  it.each([
    ['network rejection', async () => Promise.reject(new Error('network down'))],
    ['auth-service 5xx', async () => ({ ok: false, status: 503, json: async () => ({ error: 'down' }) })],
  ])('returns 502 when auth-service active verification has %s', async (_caseName, fetchImpl) => {
    global.fetch = fetchImpl;

    const res = await request(app)
      .post(`/api/v1/users/${userB._id}/follow`)
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(502);
  });

  it('unfollows another user and removes the feed compatibility following entry', async () => {
    await request(app)
      .post(`/api/v1/users/${userB._id}/follow`)
      .set('Authorization', `Bearer ${tokenA}`);

    const unfollow = await request(app)
      .delete(`/api/v1/users/${userB._id}/follow`)
      .set('Authorization', `Bearer ${tokenA}`);
    const storedUser = await User.findById(userA._id);
    const followCount = await Follow.countDocuments({ follower: userA._id, following: userB._id });

    expect(unfollow.status).toBe(200);
    expect(followCount).toBe(0);
    expect(storedUser.following).toHaveLength(0);
  });

  it('lists followers without leaking private fields', async () => {
    await request(app)
      .post(`/api/v1/users/${userB._id}/follow`)
      .set('Authorization', `Bearer ${tokenA}`);

    const res = await request(app).get(`/api/v1/users/${userB._id}/followers`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([{ id: userA._id.toString(), username: 'userA' }]);
    expect(res.body[0]).not.toHaveProperty('email');
    expect(res.body[0]).not.toHaveProperty('password');
    expect(res.body[0]).not.toHaveProperty('passwordHash');
    expect(res.body[0]).not.toHaveProperty('displayName');
    expect(res.body[0]).not.toHaveProperty('avatarUrl');
  });

  it('keeps follow read endpoints public when auth-service is unavailable', async () => {
    await Follow.create({ follower: userA._id, following: userB._id });
    global.fetch = async () => Promise.reject(new Error('auth-service unavailable'));

    const followers = await request(app).get(`/api/v1/users/${userB._id}/followers`);
    const following = await request(app).get(`/api/v1/users/${userA._id}/following`);

    expect(followers.status).toBe(200);
    expect(following.status).toBe(200);
  });

  it('lists following without leaking private fields', async () => {
    await request(app)
      .post(`/api/v1/users/${userB._id}/follow`)
      .set('Authorization', `Bearer ${tokenA}`);

    const res = await request(app).get(`/api/v1/users/${userA._id}/following`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([{ id: userB._id.toString(), username: 'userB' }]);
    expect(res.body[0]).not.toHaveProperty('email');
    expect(res.body[0]).not.toHaveProperty('password');
    expect(res.body[0]).not.toHaveProperty('passwordHash');
    expect(res.body[0]).not.toHaveProperty('displayName');
    expect(res.body[0]).not.toHaveProperty('avatarUrl');
  });

  it('rejects follow actions from inactive users', async () => {
    await User.findByIdAndUpdate(userA._id, { isActive: false });

    const res = await request(app)
      .post(`/api/v1/users/${userB._id}/follow`)
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(403);
    expect(res.body).toHaveProperty('error');
  });
});

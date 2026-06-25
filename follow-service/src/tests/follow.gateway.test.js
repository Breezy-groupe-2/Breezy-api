const jwt = require('jsonwebtoken');
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const request = require('supertest');

process.env.JWT_SECRET = 'test_secret';

const app = require('../app');
const Follow = require('../models/follow.model');
const User = require('../models/user.model');

let mongod;
const originalFetch = global.fetch;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
});

afterAll(async () => {
  global.fetch = originalFetch;
  await mongoose.disconnect();
  await mongod.stop();
});

beforeEach(async () => {
  await User.deleteMany({});
  await Follow.deleteMany({});
});

describe('gateway split-database follow behavior', () => {
  it('follows auth-service users when the follow database has no user snapshots', async () => {
    const followerId = new mongoose.Types.ObjectId();
    const followingId = new mongoose.Types.ObjectId();
    const token = jwt.sign({ sub: followerId.toString(), role: 'user' }, process.env.JWT_SECRET, {
      expiresIn: '15m',
    });
    global.fetch = async (url) => {
      if (url.endsWith('/api/v1/users/me')) {
        return { ok: true, status: 200, json: async () => ({}) };
      }
      if (url.endsWith(`/internal/users/${followerId}`)) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ id: followerId.toString(), username: 'gatewayFollower', isActive: true }),
        };
      }
      if (url.endsWith(`/internal/users/${followingId}`)) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ id: followingId.toString(), username: 'gatewayTarget', isActive: true }),
        };
      }
      return { ok: false, status: 404, json: async () => ({ error: 'User not found' }) };
    };

    const follow = await request(app)
      .post(`/api/v1/users/${followingId}/follow`)
      .set('Authorization', `Bearer ${token}`);
    const following = await request(app).get(`/api/v1/users/${followerId}/following`);

    expect(follow.status).toBe(200);
    expect(follow.body).toMatchObject({
      followerId: followerId.toString(),
      followingId: followingId.toString(),
    });
    expect(following.status).toBe(200);
    expect(following.body.data).toEqual([
      {
        id: followingId.toString(),
        username: 'gatewayTarget',
        displayName: 'gatewayTarget',
        avatarUrl: '',
      },
    ]);
  });
});

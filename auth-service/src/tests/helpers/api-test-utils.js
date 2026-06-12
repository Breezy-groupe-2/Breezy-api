const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const request = require('supertest');
const app = require('../../app');
const Like = require('../../models/like.model');
const Post = require('../../models/post.model');
const User = require('../../models/user.model');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_secret';

let mongod;

const clearDatabase = async () => {
  await Promise.all([Like.deleteMany({}), Post.deleteMany({}), User.deleteMany({})]);
};

const setupAcceptanceDb = () => {
  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());
  });

  beforeEach(async () => {
    await clearDatabase();
  });

  afterEach(async () => {
    await clearDatabase();
  });

  afterAll(async () => {
    await mongoose.disconnect();
    if (mongod) {
      await mongod.stop();
    }
  });
};

const userPayload = (suffix, overrides = {}) => ({
  username: `user${suffix}`,
  email: `user${suffix}@example.com`,
  password: 'Password123',
  ...overrides,
});

const authHeader = (token) => ({ Authorization: `Bearer ${token}` });

const registerUser = async (payload = userPayload('a')) =>
  request(app).post('/api/v1/auth/register').send(payload);

const loginUser = async ({ email, password }) =>
  request(app).post('/api/v1/auth/login').send({ email, password });

const registerAndLogin = async (suffix, overrides = {}) => {
  const payload = userPayload(suffix, overrides);
  const registerRes = await registerUser(payload);
  const loginRes = await loginUser({ email: payload.email, password: payload.password });

  return {
    payload,
    registerRes,
    loginRes,
    token: loginRes.body.token,
    user: loginRes.body.user,
  };
};

const createPost = async (token, content = 'Hello Breezy!') =>
  request(app).post('/api/v1/posts').set(authHeader(token)).send({ content });

const expectJsonError = (res, status) => {
  expect(res.status).toBe(status);
  expect(res.body).toHaveProperty('error');
};

module.exports = {
  app,
  authHeader,
  createPost,
  expectJsonError,
  loginUser,
  mongoose,
  registerAndLogin,
  registerUser,
  setupAcceptanceDb,
  userPayload,
  models: {
    Like,
    Post,
    User,
  },
};

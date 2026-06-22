const { MongoMemoryServer } = require('mongodb-memory-server');
const express = require('express');
const mongoose = require('mongoose');
const request = require('supertest');
const authServiceApp = require('../../app');
const User = require('../../models/user.model');
const postServiceApp = require('../../../../post-service/src/app');
const commentServiceApp = require('../../../../comment-service/src/app');
const followServiceApp = require('../../../../follow-service/src/app');
const feedServiceApp = require('../../../../feed-service/src/app');
const profileServiceApp = require('../../../../profile-service/src/app');
const Follow = require('../../../../follow-service/src/models/follow.model');
const Like = require('../../../../post-service/src/models/like.model');
const Post = require('../../../../post-service/src/models/post.model');
const Profile = require('../../../../profile-service/src/models/profile.model');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_secret';

const app = express();
app.use(authServiceApp);
app.use(postServiceApp);
app.use(commentServiceApp);
app.use(followServiceApp);
app.use(profileServiceApp);
app.use(feedServiceApp);

let mongod;
let server;
const serviceUrlEnv = {
  AUTH_SERVICE_URL: process.env.AUTH_SERVICE_URL,
  FOLLOW_SERVICE_URL: process.env.FOLLOW_SERVICE_URL,
  POST_SERVICE_URL: process.env.POST_SERVICE_URL,
};

const clearDatabase = async () => {
  await Promise.all([
    Follow.deleteMany({}),
    Like.deleteMany({}),
    Post.deleteMany({}),
    Profile.deleteMany({}),
    User.deleteMany({}),
  ]);
};

const setupAcceptanceDb = () => {
  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());
    server = app.listen(0);
    const serviceUrl = `http://127.0.0.1:${server.address().port}`;
    process.env.AUTH_SERVICE_URL = serviceUrl;
    process.env.FOLLOW_SERVICE_URL = serviceUrl;
    process.env.POST_SERVICE_URL = serviceUrl;
  });

  beforeEach(async () => {
    await clearDatabase();
  });

  afterEach(async () => {
    await clearDatabase();
  });

  afterAll(async () => {
    if (server) {
      await new Promise((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      });
    }
    await mongoose.disconnect();
    if (mongod) {
      await mongod.stop();
    }
    Object.entries(serviceUrlEnv).forEach(([key, value]) => {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    });
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
    Follow,
    Like,
    Post,
    Profile,
    User,
  },
};

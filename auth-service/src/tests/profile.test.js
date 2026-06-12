const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const request = require('supertest');
const app = require('../app');
const User = require('../models/user.model');

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

  await request(app).post('/api/v1/auth/register').send(userPayload);
  const res = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: userPayload.email, password: userPayload.password });
  token = res.body.token;
  userId = res.body.user.id;
});

describe('GET /api/v1/users/:id', () => {
  it('returns 200 and public profile', async () => {
    const res = await request(app).get(`/api/v1/users/${userId}`);

    expect(res.status).toBe(200);
    expect(res.body.username).toBe('testuser');
    expect(res.body).not.toHaveProperty('passwordHash');
  });

  it('returns 404 for unknown user', async () => {
    const fakeId = new mongoose.Types.ObjectId();
    const res = await request(app).get(`/api/v1/users/${fakeId}`);

    expect(res.status).toBe(404);
  });
});

describe('PUT /api/v1/users/me', () => {
  it('returns 200 and updated profile', async () => {
    const res = await request(app)
      .put('/api/v1/users/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ bio: 'Hello world', avatar: 'https://example.com/avatar.jpg' });

    expect(res.status).toBe(200);
    expect(res.body.bio).toBe('Hello world');
    expect(res.body.avatar).toBe('https://example.com/avatar.jpg');
  });

  it('returns 400 when bio exceeds 160 characters', async () => {
    const res = await request(app)
      .put('/api/v1/users/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ bio: 'a'.repeat(161) });

    expect(res.status).toBe(400);
  });

  it('returns 400 when avatar is not a valid URL', async () => {
    const res = await request(app)
      .put('/api/v1/users/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ avatar: 'not-a-url' });

    expect(res.status).toBe(400);
  });

  it('returns 401 when not authenticated', async () => {
    const res = await request(app).put('/api/v1/users/me').send({ bio: 'Hello' });
    expect(res.status).toBe(401);
  });
});

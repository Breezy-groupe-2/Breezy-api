process.env.JWT_SECRET = 'test_secret';
process.env.AUTH_SERVICE_URL = 'http://auth-service:3001';

const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../app');
const Profile = require('../models/profile.model');

let mongod;

const userId = new mongoose.Types.ObjectId().toString();
const makeToken = (id = userId) =>
  jwt.sign({ sub: id, username: 'testuser', email: 'test@example.com', role: 'user' }, 'test_secret', {
    expiresIn: '1h',
  });

beforeAll(async () => {
  global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

afterEach(async () => {
  await Profile.deleteMany({});
  vi.clearAllMocks();
});

describe('GET /api/v1/users/:id', () => {
  it('returns empty profile when user has no profile yet', async () => {
    const res = await request(app).get(`/api/v1/users/${userId}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ userId: userId.toString(), bio: '', avatar: '' });
  });

  it('returns 404 for invalid userId format', async () => {
    const res = await request(app).get('/api/v1/users/not-an-id');

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error');
  });

  it('returns profile data when profile exists', async () => {
    await Profile.create({ userId, bio: 'Hello world', avatar: 'https://example.com/avatar.jpg' });

    const res = await request(app).get(`/api/v1/users/${userId}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      userId: userId.toString(),
      bio: 'Hello world',
      avatar: 'https://example.com/avatar.jpg',
    });
  });
});

describe('GET /api/v1/users/me', () => {
  it('returns 401 without token', async () => {
    const res = await request(app).get('/api/v1/users/me');

    expect(res.status).toBe(401);
  });

  it('returns own profile with user info from token', async () => {
    const token = makeToken();
    await Profile.create({ userId, bio: 'My bio', avatar: '' });

    const res = await request(app).get('/api/v1/users/me').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: userId.toString(),
      username: 'testuser',
      email: 'test@example.com',
      bio: 'My bio',
      avatar: '',
    });
  });

  it('returns empty profile when no profile exists yet', async () => {
    const token = makeToken();

    const res = await request(app).get('/api/v1/users/me').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ bio: '', avatar: '' });
  });
});

describe('PUT /api/v1/users/me', () => {
  it('returns 401 without token', async () => {
    const res = await request(app).put('/api/v1/users/me').send({ bio: 'test' });

    expect(res.status).toBe(401);
  });

  it('creates profile with bio and avatar', async () => {
    const token = makeToken();
    const payload = { bio: 'Hello!', avatar: 'https://example.com/avatar.jpg' };

    const res = await request(app)
      .put('/api/v1/users/me')
      .set('Authorization', `Bearer ${token}`)
      .send(payload);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ bio: 'Hello!', avatar: 'https://example.com/avatar.jpg' });
  });

  it('updates only bio when avatar is omitted', async () => {
    const token = makeToken();
    await Profile.create({ userId, bio: 'Old bio', avatar: 'https://example.com/old.jpg' });

    const res = await request(app)
      .put('/api/v1/users/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ bio: 'New bio' });

    expect(res.status).toBe(200);
    expect(res.body.bio).toBe('New bio');
    expect(res.body.avatar).toBe('https://example.com/old.jpg');
  });

  it('returns 400 when bio exceeds 160 characters', async () => {
    const token = makeToken();

    const res = await request(app)
      .put('/api/v1/users/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ bio: 'a'.repeat(161) });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error', 'Validation failed');
  });

  it('returns 400 when avatar is not a valid URL', async () => {
    const token = makeToken();

    const res = await request(app)
      .put('/api/v1/users/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ avatar: 'not-a-url' });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error', 'Validation failed');
  });
});

const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const request = require('supertest');
const app = require('../app');
const Report = require('../models/report.model');
const User = require('../models/user.model');

let mongod;
const originalFetch = global.fetch;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

afterEach(async () => {
  global.fetch = originalFetch;
  await Report.deleteMany({});
  await User.deleteMany({});
});

process.env.JWT_SECRET = 'test_secret';

const validPayload = {
  username: 'testuser',
  email: 'test@example.com',
  password: 'Password123',
};

const validTheme = {
  theme: {
    mode: 'dark',
    accentColor: '#1DA1F2',
  },
};

describe('POST /api/v1/auth/register', () => {
  it('returns 201 and user data on valid input', async () => {
    const res = await request(app).post('/api/v1/auth/register').send(validPayload);

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('token');
    expect(res.body.user).toMatchObject({
      username: 'testuser',
      email: 'test@example.com',
      role: 'user',
    });
    expect(res.body.user).not.toHaveProperty('passwordHash');
  });

  it('returns 400 when username is too short', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ ...validPayload, username: 'ab' });

    expect(res.status).toBe(400);
    expect(res.body.details[0].field).toBe('username');
  });

  it('returns 400 for invalid email', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ ...validPayload, email: 'not-an-email' });

    expect(res.status).toBe(400);
    expect(res.body.details[0].field).toBe('email');
  });

  it('returns 400 when password is too short', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ ...validPayload, password: 'short' });

    expect(res.status).toBe(400);
    expect(res.body.details[0].field).toBe('password');
  });

  it('returns 409 on duplicate email', async () => {
    await request(app).post('/api/v1/auth/register').send(validPayload);
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ ...validPayload, username: 'otheruser' });

    expect(res.status).toBe(409);
  });

  it('returns 409 on duplicate username', async () => {
    await request(app).post('/api/v1/auth/register').send(validPayload);
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ ...validPayload, email: 'other@example.com' });

    expect(res.status).toBe(409);
  });
});

describe('POST /api/v1/auth/login', () => {
  beforeEach(async () => {
    await request(app).post('/api/v1/auth/register').send(validPayload);
  });

  it('returns 200 and a JWT token on valid credentials', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: validPayload.email, password: validPayload.password });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
    expect(res.body.user).toMatchObject({ email: validPayload.email, role: 'user' });
    expect(res.body.user).not.toHaveProperty('passwordHash');
  });

  it('returns 401 on wrong password', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: validPayload.email, password: 'WrongPass1' });

    expect(res.status).toBe(401);
  });

  it('returns 401 for unknown email', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'nobody@example.com', password: validPayload.password });

    expect(res.status).toBe(401);
  });
});

describe('GET /api/v1/auth/me', () => {
  let token;

  beforeEach(async () => {
    await request(app).post('/api/v1/auth/register').send(validPayload);
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: validPayload.email, password: validPayload.password });
    token = res.body.token;
  });

  it('returns 200 and current user when authenticated', async () => {
    const res = await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ username: validPayload.username, email: validPayload.email });
  });

  it('returns default theme preferences when stored preferences are missing', async () => {
    await User.updateOne({ email: validPayload.email }, { $unset: { preferences: '' } });

    const res = await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.preferences.theme).toEqual({ mode: 'light', accentColor: '#1DA1F2' });
  });

  it('returns 200 for the users/me alias used by the web client', async () => {
    const res = await request(app).get('/api/v1/users/me').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ username: validPayload.username, email: validPayload.email });
  });

  it('returns 401 when no token is provided', async () => {
    const res = await request(app).get('/api/v1/auth/me');
    expect(res.status).toBe(401);
  });

  it('returns 401 on invalid token', async () => {
    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', 'Bearer invalidtoken');
    expect(res.status).toBe(401);
  });
});

describe('PUT /api/v1/users/me', () => {
  let token;
  const bannerUrl = 'http://localhost:3010/breezy-media/banner.png';

  beforeEach(async () => {
    await request(app).post('/api/v1/auth/register').send(validPayload);
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: validPayload.email, password: validPayload.password });
    token = res.body.token;
  });

  it('returns 200 and persists bannerUrl', async () => {
    const res = await request(app)
      .put('/api/v1/users/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ bannerUrl });

    expect(res.status).toBe(200);
    expect(res.body.bannerUrl).toBe(bannerUrl);
  });

  it('exposes bannerUrl through the public profile lookup', async () => {
    await request(app)
      .put('/api/v1/users/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ bannerUrl });

    const res = await request(app).get(`/api/v1/users/${validPayload.username}`);

    expect(res.status).toBe(200);
    expect(res.body.bannerUrl).toBe(bannerUrl);
  });

  it('clears bannerUrl when sent an empty string', async () => {
    await request(app)
      .put('/api/v1/users/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ bannerUrl });

    const res = await request(app)
      .put('/api/v1/users/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ bannerUrl: '' });

    expect(res.status).toBe(200);
    expect(res.body.bannerUrl).toBe('');
  });

  it('returns 401 when no token is provided', async () => {
    const res = await request(app).put('/api/v1/users/me').send({ bannerUrl });

    expect(res.status).toBe(401);
  });

  it('includes bannerUrl in the internal user summary', async () => {
    await request(app)
      .put('/api/v1/users/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ bannerUrl });

    const user = await User.findOne({ email: validPayload.email });
    const res = await request(app).get(`/internal/users/${user._id}`);

    expect(res.status).toBe(200);
    expect(res.body.bannerUrl).toBe(bannerUrl);
  });
});

describe('GET /api/v1/users/search', () => {
  let token;

  beforeEach(async () => {
    await request(app).post('/api/v1/auth/register').send(validPayload);
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: validPayload.email, password: validPayload.password });
    token = res.body.token;
    // A few other users to search for.
    await request(app)
      .post('/api/v1/auth/register')
      .send({ username: 'alice', email: 'alice@example.com', password: 'Password123' });
    await request(app)
      .post('/api/v1/auth/register')
      .send({ username: 'alicia', email: 'alicia@example.com', password: 'Password123' });
    await request(app)
      .post('/api/v1/auth/register')
      .send({ username: 'bob', email: 'bob@example.com', password: 'Password123' });
  });

  it('returns users whose username matches the query (case-insensitive)', async () => {
    const res = await request(app)
      .get('/api/v1/users/search?q=ALI')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const usernames = res.body.map((u) => u.username).sort();
    expect(usernames).toEqual(['alice', 'alicia']);
  });

  it('excludes the viewer from the results', async () => {
    const res = await request(app)
      .get(`/api/v1/users/search?q=${validPayload.username}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('returns an empty array for a blank query', async () => {
    const res = await request(app)
      .get('/api/v1/users/search?q=')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('treats regex metacharacters as plain text', async () => {
    const res = await request(app)
      .get('/api/v1/users/search?q=.*')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('returns 401 when no token is provided', async () => {
    const res = await request(app).get('/api/v1/users/search?q=ali');
    expect(res.status).toBe(401);
  });
});

describe('PATCH /api/v1/users/me/preferences', () => {
  let token;

  beforeEach(async () => {
    await request(app).post('/api/v1/auth/register').send(validPayload);
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: validPayload.email, password: validPayload.password });
    token = res.body.token;
  });

  it('returns 200 and saves theme preferences when authenticated', async () => {
    const res = await request(app)
      .patch('/api/v1/users/me/preferences')
      .set('Authorization', `Bearer ${token}`)
      .send(validTheme);

    expect(res.status).toBe(200);
    expect(res.body.theme).toEqual(validTheme.theme);
  });

  it('returns 401 when no token is provided', async () => {
    const res = await request(app).patch('/api/v1/users/me/preferences').send(validTheme);

    expect(res.status).toBe(401);
  });

  it('returns 404 when the authenticated user no longer exists', async () => {
    await User.deleteOne({ email: validPayload.email });

    const res = await request(app)
      .patch('/api/v1/users/me/preferences')
      .set('Authorization', `Bearer ${token}`)
      .send(validTheme);

    expect(res.status).toBe(404);
  });

  it('returns 400 when theme mode is unsupported', async () => {
    const res = await request(app)
      .patch('/api/v1/users/me/preferences')
      .set('Authorization', `Bearer ${token}`)
      .send({ theme: { mode: 'neon', accentColor: '#1DA1F2' } });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation failed');
  });

  it('returns 400 when accent color is not a hex color', async () => {
    const res = await request(app)
      .patch('/api/v1/users/me/preferences')
      .set('Authorization', `Bearer ${token}`)
      .send({ theme: { mode: 'light', accentColor: 'blue' } });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation failed');
  });

  it('returns 400 when payload contains extra preference keys', async () => {
    const res = await request(app)
      .patch('/api/v1/users/me/preferences')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...validTheme, layout: 'compact' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation failed');
  });

  it('returns saved theme preferences from the current-user endpoint', async () => {
    await request(app)
      .patch('/api/v1/users/me/preferences')
      .set('Authorization', `Bearer ${token}`)
      .send(validTheme);

    const me = await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${token}`);

    expect(me.status).toBe(200);
    expect(me.body.preferences.theme).toEqual(validTheme.theme);
  });
});

describe('POST /api/v1/moderation/reports (Fx20)', () => {
  let token;
  const postId = new mongoose.Types.ObjectId().toString();
  const postSnapshot = {
    id: postId,
    content: 'Trusted post content',
    author: {
      id: new mongoose.Types.ObjectId().toString(),
      username: 'actualauthor',
      displayName: 'Actual Author',
      avatarUrl: 'https://cdn.example.test/avatar.png',
    },
  };
  const report = {
    postId,
    reason: 'Contenu inapproprié',
  };

  beforeEach(async () => {
    await request(app).post('/api/v1/auth/register').send(validPayload);
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: validPayload.email, password: validPayload.password });
    token = res.body.token;
    global.fetch = async () => ({
      ok: true,
      status: 200,
      json: async () => postSnapshot,
    });
  });

  it('lets an authenticated user file a post report from a trusted post snapshot (201)', async () => {
    const res = await request(app)
      .post('/api/v1/moderation/reports')
      .set('Authorization', `Bearer ${token}`)
      .send(report);
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ kind: 'post', reason: 'Contenu inapproprié' });
    expect(res.body.author).toMatchObject({
      username: 'actualauthor',
      displayName: 'Actual Author',
      avatarUrl: 'https://cdn.example.test/avatar.png',
    });
    expect(res.body.text).toBe('Trusted post content');
    expect(res.body.postId).toBe(postId);
  });

  it('rejects client-supplied snapshot fields so reports cannot be spoofed (400)', async () => {
    const res = await request(app)
      .post('/api/v1/moderation/reports')
      .set('Authorization', `Bearer ${token}`)
      .send({
        ...report,
        author: { username: 'spoofed', displayName: 'Spoofed User' },
        text: 'fake report content',
      });
    expect(res.status).toBe(400);
  });

  it('rejects an invalid reason (400)', async () => {
    const res = await request(app)
      .post('/api/v1/moderation/reports')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...report, reason: 'whatever' });
    expect(res.status).toBe(400);
  });

  it('rejects an invalid post id (400)', async () => {
    const res = await request(app)
      .post('/api/v1/moderation/reports')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...report, postId: 'not-an-id' });
    expect(res.status).toBe(400);
  });

  it('returns 404 when the reported post does not exist', async () => {
    global.fetch = async () => ({
      ok: false,
      status: 404,
      json: async () => ({ error: 'Post not found' }),
    });

    const res = await request(app)
      .post('/api/v1/moderation/reports')
      .set('Authorization', `Bearer ${token}`)
      .send(report);
    expect(res.status).toBe(404);
  });

  it('returns 502 when post-service cannot provide the trusted snapshot', async () => {
    global.fetch = async () => ({
      ok: false,
      status: 500,
      json: async () => ({ error: 'failed' }),
    });

    const res = await request(app)
      .post('/api/v1/moderation/reports')
      .set('Authorization', `Bearer ${token}`)
      .send(report);
    expect(res.status).toBe(502);
  });

  it('requires authentication (401)', async () => {
    const res = await request(app).post('/api/v1/moderation/reports').send(report);
    expect(res.status).toBe(401);
  });
});

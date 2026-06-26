const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const request = require('supertest');
const {
  app,
  models,
  mongoose: authMongoose,
} = require('../../../auth-service/src/tests/helpers/api-test-utils');

const { Post, User } = models;

let mongod;
let token;
let userId;

process.env.JWT_SECRET = 'test_secret';

const userPayload = { username: 'testuser', email: 'test@example.com', password: 'Password123' };

const originalFetch = global.fetch;

beforeAll(async () => {
  const publicUser = (id) => ({
    id,
    username: `user-${id.slice(-4)}`,
    displayName: `user-${id.slice(-4)}`,
    avatarUrl: `https://i.pravatar.cc/150?u=${id}`,
    isActive: true,
  });
  global.fetch = async (url = '') => {
    const s = String(url);
    // Unknown username resolution returns 404 (mirrors auth-service behaviour).
    if (s.includes('/internal/users/by-username/')) {
      return { ok: false, status: 404, json: async () => ({ error: 'User not found' }) };
    }
    // Batched author enrichment: echo each requested id back as a public user.
    const batch = s.match(/\/internal\/users\?ids=([^&]+)/);
    if (batch) {
      const ids = decodeURIComponent(batch[1]).split(',').filter(Boolean);
      return { ok: true, status: 200, json: async () => ids.map(publicUser) };
    }
    const single = s.match(/\/internal\/users\/([^/?]+)/);
    if (single) {
      return { ok: true, status: 200, json: async () => publicUser(single[1]) };
    }
    return { ok: true, status: 200, json: async () => ({ isActive: true }) };
  };
  mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  await mongoose.connect(uri);
  await authMongoose.connect(uri);
});

afterAll(async () => {
  global.fetch = originalFetch;
  await mongoose.disconnect();
  await authMongoose.disconnect();
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

  it('returns 200 and empty array for unknown but valid user id', async () => {
    const unknownUserId = new mongoose.Types.ObjectId();

    const res = await request(app).get(`/api/v1/posts/user/${unknownUserId}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});

describe('GET /api/v1/posts?authorIds=<ids>&limit=<n>', () => {
  it('returns batched posts newest first for all requested authors', async () => {
    const authorA = new mongoose.Types.ObjectId();
    const authorB = new mongoose.Types.ObjectId();
    const outsider = new mongoose.Types.ObjectId();

    await Post.create([
      { content: 'old author A', author: authorA, createdAt: new Date('2026-01-01T00:00:00.000Z') },
      { content: 'new author B', author: authorB, createdAt: new Date('2026-01-03T00:00:00.000Z') },
      {
        content: 'middle author A',
        author: authorA,
        createdAt: new Date('2026-01-02T00:00:00.000Z'),
      },
      {
        content: 'outsider post',
        author: outsider,
        createdAt: new Date('2026-01-04T00:00:00.000Z'),
      },
    ]);

    const res = await request(app).get(`/api/v1/posts?authorIds=${authorA},${authorB}&limit=10`);

    expect(res.status).toBe(200);
    expect(res.body.map((post) => post.content)).toEqual([
      'new author B',
      'middle author A',
      'old author A',
    ]);
    expect(
      res.body.every((post) => [authorA.toString(), authorB.toString()].includes(post.author.id))
    ).toBe(true);
    expect(res.body[0]).toHaveProperty('likeCount', 0);
  });

  it('uses default limit 20 when limit is omitted', async () => {
    const authorA = new mongoose.Types.ObjectId();
    const authorB = new mongoose.Types.ObjectId();
    const posts = Array.from({ length: 25 }, (_, index) => ({
      content: `post ${index}`,
      author: index % 2 === 0 ? authorA : authorB,
      createdAt: new Date(Date.UTC(2026, 0, index + 1)),
    }));
    await Post.create(posts);

    const res = await request(app).get(`/api/v1/posts?authorIds=${authorA},${authorB}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(20);
    expect(res.body[0].content).toBe('post 24');
    expect(res.body[19].content).toBe('post 5');
  });

  it('accepts explicit limit from 1 to 100', async () => {
    const author = new mongoose.Types.ObjectId();
    await Post.create([
      { content: 'older', author, createdAt: new Date('2026-01-01T00:00:00.000Z') },
      { content: 'newer', author, createdAt: new Date('2026-01-02T00:00:00.000Z') },
    ]);

    const limitOneRes = await request(app).get(`/api/v1/posts?authorIds=${author}&limit=1`);
    const limitOneHundredRes = await request(app).get(
      `/api/v1/posts?authorIds=${author}&limit=100`
    );

    expect(limitOneRes.status).toBe(200);
    expect(limitOneRes.body.map((post) => post.content)).toEqual(['newer']);
    expect(limitOneHundredRes.status).toBe(200);
    expect(limitOneHundredRes.body.map((post) => post.content)).toEqual(['newer', 'older']);
  });

  it('returns an empty array for empty authorIds', async () => {
    const res = await request(app).get('/api/v1/posts?authorIds=');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('returns 400 for malformed ObjectId in authorIds', async () => {
    const res = await request(app).get('/api/v1/posts?authorIds=not-an-id');

    expect(res.status).toBe(400);
  });

  it('returns 400 for more than 100 author IDs', async () => {
    const authorIds = Array.from({ length: 101 }, () => new mongoose.Types.ObjectId()).join(',');

    const res = await request(app).get(`/api/v1/posts?authorIds=${authorIds}`);

    expect(res.status).toBe(400);
  });
});

describe('GET /api/v1/posts/me', () => {
  it('returns 200 and own posts', async () => {
    await request(app)
      .post('/api/v1/posts')
      .set('Authorization', `Bearer ${token}`)
      .send({ content: 'My post' });

    const res = await request(app).get('/api/v1/posts/me').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].content).toBe('My post');
  });

  it('returns 401 when not authenticated', async () => {
    const res = await request(app).get('/api/v1/posts/me');

    expect(res.status).toBe(401);
  });
});

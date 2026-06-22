const request = require('supertest');
const jwt = require('jsonwebtoken');
const { app, models, setupAcceptanceDb } = require('./helpers/api-test-utils');

const { Follow, Post, User } = models;

setupAcceptanceDb();

let tokenA;
let tokenB;
let tokenC;
let userAId;
let userBId;
let userCId;

const userA = { username: 'userA', email: 'a@example.com', password: 'Password123' };
const userB = { username: 'userB', email: 'b@example.com', password: 'Password123' };
const userC = { username: 'userC', email: 'c@example.com', password: 'Password123' };

beforeEach(async () => {
  await User.deleteMany({});
  await Post.deleteMany({});
  await Follow.deleteMany({});

  await request(app).post('/api/v1/auth/register').send(userA);
  const resA = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: userA.email, password: userA.password });
  tokenA = resA.body.token;
  userAId = resA.body.user.id;

  await request(app).post('/api/v1/auth/register').send(userB);
  const resB = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: userB.email, password: userB.password });
  tokenB = resB.body.token;
  userBId = resB.body.user.id;

  await request(app).post('/api/v1/auth/register').send(userC);
  const resC = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: userC.email, password: userC.password });
  tokenC = resC.body.token;
  userCId = resC.body.user.id;
});

describe('GET /api/v1/feed', () => {
  it('returns 200 and empty array when not following anyone', async () => {
    const res = await request(app).get('/api/v1/feed').set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('returns posts from followed users sorted newest first', async () => {
    await Follow.create({ follower: userAId, following: userBId });

    await request(app)
      .post('/api/v1/posts')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ content: 'First post' });
    await request(app)
      .post('/api/v1/posts')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ content: 'Second post' });

    const res = await request(app).get('/api/v1/feed').set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0].content).toBe('Second post');
    expect(res.body[1].content).toBe('First post');
  });

  it('uses one batched post-service request for feed with multiple followees', async () => {
    await Follow.create([
      { follower: userAId, following: userBId },
      { follower: userAId, following: userCId },
    ]);

    await request(app)
      .post('/api/v1/posts')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ content: 'Post from B' });
    await request(app)
      .post('/api/v1/posts')
      .set('Authorization', `Bearer ${tokenC}`)
      .send({ content: 'Post from C' });

    const originalFetch = global.fetch;
    const fetchedUrls = [];
    global.fetch = async (url, options) => {
      fetchedUrls.push(String(url));
      return originalFetch(url, options);
    };

    try {
      const res = await request(app).get('/api/v1/feed?limit=2').set('Authorization', `Bearer ${tokenA}`);
      const postFetchUrls = fetchedUrls.filter((url) => url.includes('/api/v1/posts'));
      const perFolloweePostFetchUrls = postFetchUrls.filter((url) => url.includes('/api/v1/posts/user/'));

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      expect(res.body[0].createdAt >= res.body[1].createdAt).toBe(true);
      expect(postFetchUrls).toHaveLength(1);
      expect(postFetchUrls[0]).toContain('/api/v1/posts?authorIds=');
      expect(postFetchUrls[0]).toContain('limit=2');
      expect(postFetchUrls[0]).toContain(userBId);
      expect(postFetchUrls[0]).toContain(userCId);
      expect(perFolloweePostFetchUrls).toEqual([]);
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('respects feed query limit', async () => {
    await Follow.create({ follower: userAId, following: userBId });

    await request(app)
      .post('/api/v1/posts')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ content: 'First post' });
    await request(app)
      .post('/api/v1/posts')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ content: 'Second post' });

    const res = await request(app).get('/api/v1/feed?limit=1').set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].content).toBe('Second post');
  });

  it('maps a non-OK post-service batch response without returning a partial feed', async () => {
    await Follow.create({ follower: userAId, following: userBId });

    const originalFetch = global.fetch;
    global.fetch = async (url, options) => {
      if (String(url).includes('/api/v1/posts?authorIds=')) {
        return new Response(JSON.stringify({ error: 'post-service unavailable' }), { status: 502 });
      }
      return originalFetch(url, options);
    };

    try {
      const res = await request(app).get('/api/v1/feed').set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(502);
      expect(res.body).toEqual({ error: 'Upstream service request failed: 502' });
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('does not return posts from non-followed users', async () => {
    await request(app)
      .post('/api/v1/posts')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ content: 'Post from B' });

    const res = await request(app).get('/api/v1/feed').set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('returns 401 when no token is provided', async () => {
    const res = await request(app).get('/api/v1/feed');
    expect(res.status).toBe(401);
  });

  it.each(['not-a-jwt', jwt.sign({ sub: 'expired-user', role: 'user' }, 'test_secret', { expiresIn: '-1s' })])(
    'returns 401 when token is invalid or expired',
    async (badToken) => {
      const res = await request(app).get('/api/v1/feed').set('Authorization', `Bearer ${badToken}`);

      expect(res.status).toBe(401);
    }
  );

  it.each([
    ['inactive', { isActive: false }],
    ['banned', { moderationStatus: 'banned' }],
    ['suspended', { moderationStatus: 'suspended' }],
  ])('returns 403 when authenticated user is %s', async (_caseName, update) => {
    await User.findByIdAndUpdate(userAId, update);

    const res = await request(app).get('/api/v1/feed').set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(403);
  });

  it('returns 404 when authenticated user no longer exists', async () => {
    await User.findByIdAndDelete(userAId);

    const res = await request(app).get('/api/v1/feed').set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(404);
  });

  it.each([
    ['network rejection', async () => Promise.reject(new Error('network down'))],
    ['auth-service 5xx', async () => new Response(JSON.stringify({ error: 'down' }), { status: 503 })],
  ])('returns 502 when auth-service active verification has %s', async (_caseName, fetchImpl) => {
    const originalFetch = global.fetch;
    global.fetch = async (url, options) => {
      if (String(url).includes('/api/v1/users/me')) {
        return fetchImpl(url, options);
      }
      return originalFetch(url, options);
    };

    try {
      const res = await request(app).get('/api/v1/feed').set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(502);
    } finally {
      global.fetch = originalFetch;
    }
  });
});

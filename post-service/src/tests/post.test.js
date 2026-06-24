const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { app, models, mongoose: authMongoose } = require('../../../auth-service/src/tests/helpers/api-test-utils');

const { Post, User } = models;

let mongod;
let token;

process.env.JWT_SECRET = 'test_secret';

const userPayload = {
  username: 'testuser',
  email: 'test@example.com',
  password: 'Password123',
};

const originalFetch = global.fetch;

const mockActiveUser = () => {
  global.fetch = async () => ({
    ok: true,
    status: 200,
    json: async () => ({ isActive: true }),
  });
};

beforeAll(async () => {
  mockActiveUser();
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
  mockActiveUser();
  await User.deleteMany({});
  await Post.deleteMany({});
  await request(app).post('/api/v1/auth/register').send(userPayload);
  const res = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: userPayload.email, password: userPayload.password });
  token = res.body.token;
});

describe('POST /api/v1/posts', () => {
  it('returns 201 and post data on valid input', async () => {
    const res = await request(app)
      .post('/api/v1/posts')
      .set('Authorization', `Bearer ${token}`)
      .send({ content: 'Hello Breezy!' });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ content: 'Hello Breezy!' });
    expect(res.body).toHaveProperty('id');
    expect(res.body).toHaveProperty('createdAt');
  });

  it('returns 400 when content is empty', async () => {
    const res = await request(app)
      .post('/api/v1/posts')
      .set('Authorization', `Bearer ${token}`)
      .send({ content: '' });

    expect(res.status).toBe(400);
    expect(res.body.details[0].field).toBe('content');
  });

  it('returns 400 when content exceeds 280 characters', async () => {
    const res = await request(app)
      .post('/api/v1/posts')
      .set('Authorization', `Bearer ${token}`)
      .send({ content: 'a'.repeat(281) });

    expect(res.status).toBe(400);
    expect(res.body.details[0].field).toBe('content');
  });

  it('returns 400 when content is exactly 280 characters', async () => {
    const res = await request(app)
      .post('/api/v1/posts')
      .set('Authorization', `Bearer ${token}`)
      .send({ content: 'a'.repeat(280) });

    expect(res.status).toBe(201);
  });

  it('returns 401 when no token is provided', async () => {
    const res = await request(app).post('/api/v1/posts').send({ content: 'Hello Breezy!' });

    expect(res.status).toBe(401);
  });

  it('returns 401 on invalid token', async () => {
    const res = await request(app)
      .post('/api/v1/posts')
      .set('Authorization', 'Bearer invalidtoken')
      .send({ content: 'Hello Breezy!' });

    expect(res.status).toBe(401);
  });

  it('returns 401 on expired token', async () => {
    const expiredToken = jwt.sign({ sub: new mongoose.Types.ObjectId(), role: 'user' }, 'test_secret', {
      expiresIn: '-1s',
    });

    const res = await request(app)
      .post('/api/v1/posts')
      .set('Authorization', `Bearer ${expiredToken}`)
      .send({ content: 'Hello Breezy!' });

    expect(res.status).toBe(401);
  });

  it.each([403, 404])('returns %s from auth-service active verification', async (status) => {
    global.fetch = async () => ({ ok: false, status, json: async () => ({ error: 'auth failed' }) });

    const res = await request(app)
      .post('/api/v1/posts')
      .set('Authorization', `Bearer ${token}`)
      .send({ content: 'Hello Breezy!' });

    expect(res.status).toBe(status);
  });

  it.each([
    ['network rejection', async () => Promise.reject(new Error('network down'))],
    ['auth-service 5xx', async () => ({ ok: false, status: 503, json: async () => ({ error: 'down' }) })],
  ])('returns 502 when auth-service active verification has %s', async (_caseName, fetchImpl) => {
    global.fetch = fetchImpl;

    const res = await request(app)
      .post('/api/v1/posts')
      .set('Authorization', `Bearer ${token}`)
      .send({ content: 'Hello Breezy!' });

    expect(res.status).toBe(502);
  });

  it('returns 201 and includes mediaUrl on valid input with image URL', async () => {
    const res = await request(app)
      .post('/api/v1/posts')
      .set('Authorization', `Bearer ${token}`)
      .send({ content: 'Hello Breezy!', mediaUrl: 'http://localhost:3000/breezy-media/image.png' });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      content: 'Hello Breezy!',
      mediaUrl: 'http://localhost:3000/breezy-media/image.png',
    });
  });

  it('returns 400 when mediaUrl is not a valid URL', async () => {
    const res = await request(app)
      .post('/api/v1/posts')
      .set('Authorization', `Bearer ${token}`)
      .send({ content: 'Hello Breezy!', mediaUrl: 'not-a-url' });

    expect(res.status).toBe(400);
    expect(res.body.details[0].field).toBe('mediaUrl');
  });
});

describe('GET /api/v1/posts/search', () => {
  const createPost = async (content) => {
    await request(app)
      .post('/api/v1/posts')
      .set('Authorization', `Bearer ${token}`)
      .send({ content });
  };

  it('returns posts whose content matches the query (case-insensitive)', async () => {
    await createPost('Loving #breezy today');
    await createPost('Another #BREEZY post');
    await createPost('Nothing related here');

    const res = await request(app)
      .get('/api/v1/posts/search?q=%23breezy')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body.every((p) => /breezy/i.test(p.content))).toBe(true);
  });

  it('returns an empty array for a blank query', async () => {
    await createPost('Some #tag post');
    const res = await request(app)
      .get('/api/v1/posts/search?q=')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});

describe('GET /api/v1/posts/liked/:userId', () => {
  const userId = () => jwt.decode(token).sub;

  const createPost = async (content) => {
    const res = await request(app)
      .post('/api/v1/posts')
      .set('Authorization', `Bearer ${token}`)
      .send({ content });
    return res.body;
  };

  it('returns only the posts the user has liked', async () => {
    const liked = await createPost('Liked one');
    await createPost('Not liked');
    await request(app)
      .post(`/api/v1/posts/${liked.id}/like`)
      .set('Authorization', `Bearer ${token}`);

    const res = await request(app)
      .get(`/api/v1/posts/liked/${userId()}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toMatchObject({ id: liked.id, content: 'Liked one', isLiked: true });
  });

  it('returns an empty array when the user liked nothing', async () => {
    await createPost('Untouched');
    const res = await request(app)
      .get(`/api/v1/posts/liked/${userId()}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});

describe('reposts', () => {
  const createPost = async (content = 'Original post') => {
    const res = await request(app)
      .post('/api/v1/posts')
      .set('Authorization', `Bearer ${token}`)
      .send({ content });
    return res.body;
  };

  it('plain repost: returns 201, bumps repostCount and flags isReposted', async () => {
    const original = await createPost();

    const repostRes = await request(app)
      .post(`/api/v1/posts/${original.id}/repost`)
      .set('Authorization', `Bearer ${token}`);
    expect(repostRes.status).toBe(201);
    expect(repostRes.body.repostOf).toMatchObject({ id: original.id });
    expect(repostRes.body.content).toBe('');

    const after = await request(app)
      .get(`/api/v1/posts/${original.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(after.body.repostCount).toBe(1);
    expect(after.body.isReposted).toBe(true);
  });

  it('plain repost is idempotent (no duplicate)', async () => {
    const original = await createPost();
    await request(app)
      .post(`/api/v1/posts/${original.id}/repost`)
      .set('Authorization', `Bearer ${token}`);
    await request(app)
      .post(`/api/v1/posts/${original.id}/repost`)
      .set('Authorization', `Bearer ${token}`);

    const after = await request(app)
      .get(`/api/v1/posts/${original.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(after.body.repostCount).toBe(1);
  });

  it('un-repost: returns 204 and clears the state', async () => {
    const original = await createPost();
    await request(app)
      .post(`/api/v1/posts/${original.id}/repost`)
      .set('Authorization', `Bearer ${token}`);

    const del = await request(app)
      .delete(`/api/v1/posts/${original.id}/repost`)
      .set('Authorization', `Bearer ${token}`);
    expect(del.status).toBe(204);

    const after = await request(app)
      .get(`/api/v1/posts/${original.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(after.body.repostCount).toBe(0);
    expect(after.body.isReposted).toBe(false);
  });

  it('quote repost: keeps content and embeds the original', async () => {
    const original = await createPost();

    const quote = await request(app)
      .post('/api/v1/posts')
      .set('Authorization', `Bearer ${token}`)
      .send({ content: 'Look at this', repostOf: original.id });

    expect(quote.status).toBe(201);
    expect(quote.body.content).toBe('Look at this');
    expect(quote.body.repostOf).toMatchObject({ id: original.id, content: 'Original post' });

    const after = await request(app)
      .get(`/api/v1/posts/${original.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(after.body.repostCount).toBe(1);
    // a quote does not toggle the plain-repost flag
    expect(after.body.isReposted).toBe(false);
  });

  it('reposting a repost flattens to the root post', async () => {
    const original = await createPost();
    const repost = await request(app)
      .post(`/api/v1/posts/${original.id}/repost`)
      .set('Authorization', `Bearer ${token}`);

    const repostOfRepost = await request(app)
      .post(`/api/v1/posts/${repost.body.id}/repost`)
      .set('Authorization', `Bearer ${token}`);
    // points at the original, not at the intermediate repost
    expect(repostOfRepost.body.repostOf.id).toBe(original.id);
  });

  it('excludes plain reposts from the global feed but keeps quotes', async () => {
    const original = await createPost('Solo original');
    await request(app)
      .post(`/api/v1/posts/${original.id}/repost`)
      .set('Authorization', `Bearer ${token}`);
    await request(app)
      .post('/api/v1/posts')
      .set('Authorization', `Bearer ${token}`)
      .send({ content: 'Quoting it', repostOf: original.id });

    const feed = await request(app)
      .get('/api/v1/posts/all')
      .set('Authorization', `Bearer ${token}`);

    const contents = feed.body.map((p) => p.content);
    // the original and the quote appear; the empty plain repost does not
    expect(contents).toContain('Solo original');
    expect(contents).toContain('Quoting it');
    expect(contents).not.toContain('');
  });

  it('deleting the original removes reposts pointing at it', async () => {
    const original = await createPost();
    const repost = await request(app)
      .post(`/api/v1/posts/${original.id}/repost`)
      .set('Authorization', `Bearer ${token}`);

    await request(app)
      .delete(`/api/v1/posts/${original.id}`)
      .set('Authorization', `Bearer ${token}`);

    const gone = await request(app)
      .get(`/api/v1/posts/${repost.body.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(gone.status).toBe(404);
  });
});

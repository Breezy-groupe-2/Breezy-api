const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const request = require('supertest');
const app = require('../app');
const Comment = require('../models/comment.model');
const Reply = require('../models/reply.model');

let mongod;
const postId = new mongoose.Types.ObjectId().toString();

process.env.JWT_SECRET = 'test_secret';

const jwt = require('jsonwebtoken');
const userId = new mongoose.Types.ObjectId();
const token = jwt.sign({ sub: userId, role: 'user' }, 'test_secret', { expiresIn: '1h' });

const originalFetch = global.fetch;

const mockActiveUser = () => {
  const publicUser = (id) => ({
    id,
    username: 'tester',
    displayName: 'tester',
    avatarUrl: 'https://i.pravatar.cc/150?u=tester',
    isActive: true,
  });
  global.fetch = async (url = '') => {
    const s = String(url);
    // Batched author enrichment: return a public user per requested id.
    const batch = s.match(/\/internal\/users\?ids=([^&]+)/);
    if (batch) {
      const ids = decodeURIComponent(batch[1]).split(',').filter(Boolean);
      return { ok: true, status: 200, json: async () => ids.map(publicUser) };
    }
    if (s.includes('/internal/users/')) {
      return { ok: true, status: 200, json: async () => publicUser(userId.toString()) };
    }
    return { ok: true, status: 200, json: async () => ({ isActive: true }) };
  };
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

afterEach(async () => {
  mockActiveUser();
  await Comment.deleteMany({});
  await Reply.deleteMany({});
});

describe('POST /api/v1/posts/:postId/comments', () => {
  it('returns 201 and created comment', async () => {
    const res = await request(app)
      .post(`/api/v1/posts/${postId}/comments`)
      .set('Authorization', `Bearer ${token}`)
      .send({ content: 'Great post!' });

    expect(res.status).toBe(201);
    expect(res.body.content).toBe('Great post!');
    expect(res.body.postId).toBe(postId);
  });

  it('returns 401 when not authenticated', async () => {
    const res = await request(app)
      .post(`/api/v1/posts/${postId}/comments`)
      .send({ content: 'Great post!' });

    expect(res.status).toBe(401);
  });

  it.each([403, 404])('returns %s from auth-service active verification', async (status) => {
    global.fetch = async () => ({ ok: false, status, json: async () => ({ error: 'auth failed' }) });

    const res = await request(app)
      .post(`/api/v1/posts/${postId}/comments`)
      .set('Authorization', `Bearer ${token}`)
      .send({ content: 'Great post!' });

    expect(res.status).toBe(status);
  });

  it.each([
    ['network rejection', async () => Promise.reject(new Error('network down'))],
    ['auth-service 5xx', async () => ({ ok: false, status: 503, json: async () => ({ error: 'down' }) })],
  ])('returns 502 when auth-service active verification has %s', async (_caseName, fetchImpl) => {
    global.fetch = fetchImpl;

    const res = await request(app)
      .post(`/api/v1/posts/${postId}/comments`)
      .set('Authorization', `Bearer ${token}`)
      .send({ content: 'Great post!' });

    expect(res.status).toBe(502);
  });

  it.each([
    ['empty content', ''],
    ['whitespace-only content', '   '],
    ['overlength content', 'a'.repeat(281)],
  ])('returns 400 for %s', async (_caseName, content) => {
    const res = await request(app)
      .post(`/api/v1/posts/${postId}/comments`)
      .set('Authorization', `Bearer ${token}`)
      .send({ content });

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: 'Validation failed' });
    expect(res.body.details[0]).toHaveProperty('field', 'content');
  });

  it('returns 400 when postId is malformed', async () => {
    const res = await request(app)
      .post('/api/v1/posts/not-an-id/comments')
      .set('Authorization', `Bearer ${token}`)
      .send({ content: 'Great post!' });

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: 'Invalid id format' });
  });
});

describe('GET /api/v1/posts/:postId/comments', () => {
  it('returns 200 and empty array when no comments', async () => {
    const res = await request(app).get(`/api/v1/posts/${postId}/comments`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('returns comments sorted oldest first', async () => {
    await request(app)
      .post(`/api/v1/posts/${postId}/comments`)
      .set('Authorization', `Bearer ${token}`)
      .send({ content: 'First comment' });
    await request(app)
      .post(`/api/v1/posts/${postId}/comments`)
      .set('Authorization', `Bearer ${token}`)
      .send({ content: 'Second comment' });

    const res = await request(app).get(`/api/v1/posts/${postId}/comments`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0].content).toBe('First comment');
    expect(res.body[1].content).toBe('Second comment');
    expect(res.body[0].replies).toEqual([]);
  });

  it('does not return comments for other posts', async () => {
    const otherPostId = new mongoose.Types.ObjectId().toString();
    await request(app)
      .post(`/api/v1/posts/${otherPostId}/comments`)
      .set('Authorization', `Bearer ${token}`)
      .send({ content: 'Other post comment' });

    const res = await request(app).get(`/api/v1/posts/${postId}/comments`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('includes replies for each comment', async () => {
    const comment = await Comment.create({ content: 'Parent comment', postId, author: userId });
    await Reply.create({ content: 'Nested reply', commentId: comment._id, author: userId });

    const res = await request(app).get(`/api/v1/posts/${postId}/comments`);

    expect(res.status).toBe(200);
    expect(res.body[0].replies).toEqual([
      expect.objectContaining({
        content: 'Nested reply',
        author: expect.objectContaining({ id: userId.toString() }),
      }),
    ]);
  });

  it('returns 400 when postId is malformed', async () => {
    const res = await request(app).get('/api/v1/posts/not-an-id/comments');

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: 'Invalid id format' });
  });
});

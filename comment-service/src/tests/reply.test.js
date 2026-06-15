const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const request = require('supertest');
const app = require('../app');
const Comment = require('../models/comment.model');
const Reply = require('../models/reply.model');

let mongod;
let commentId;

process.env.JWT_SECRET = 'test_secret';

const jwt = require('jsonwebtoken');
const userId = new mongoose.Types.ObjectId();
const token = jwt.sign({ sub: userId, role: 'user' }, 'test_secret', { expiresIn: '1h' });
const postId = new mongoose.Types.ObjectId().toString();

const originalFetch = global.fetch;

beforeAll(async () => {
  global.fetch = async () => ({
    ok: true,
    status: 200,
    json: async () => ({ isActive: true }),
  });
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
});

afterAll(async () => {
  global.fetch = originalFetch;
  await mongoose.disconnect();
  await mongod.stop();
});

beforeEach(async () => {
  await Comment.deleteMany({});
  await Reply.deleteMany({});

  const comment = await Comment.create({ content: 'A comment', postId, author: userId });
  commentId = comment._id.toString();
});

describe('POST /api/v1/comments/:commentId/replies', () => {
  it('returns 201 and created reply', async () => {
    const res = await request(app)
      .post(`/api/v1/comments/${commentId}/replies`)
      .set('Authorization', `Bearer ${token}`)
      .send({ content: 'A reply' });

    expect(res.status).toBe(201);
    expect(res.body.content).toBe('A reply');
    expect(res.body.commentId).toBe(commentId);
  });

  it('returns 404 when comment does not exist', async () => {
    const fakeId = new mongoose.Types.ObjectId();
    const res = await request(app)
      .post(`/api/v1/comments/${fakeId}/replies`)
      .set('Authorization', `Bearer ${token}`)
      .send({ content: 'A reply' });

    expect(res.status).toBe(404);
  });

  it('returns 401 when not authenticated', async () => {
    const res = await request(app)
      .post(`/api/v1/comments/${commentId}/replies`)
      .send({ content: 'A reply' });

    expect(res.status).toBe(401);
  });

  it.each([
    ['empty content', ''],
    ['whitespace-only content', '   '],
    ['overlength content', 'a'.repeat(281)],
  ])('returns 400 for %s', async (_caseName, content) => {
    const res = await request(app)
      .post(`/api/v1/comments/${commentId}/replies`)
      .set('Authorization', `Bearer ${token}`)
      .send({ content });

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: 'Validation failed' });
    expect(res.body.details[0]).toHaveProperty('field', 'content');
  });
});

describe('GET /api/v1/comments/:commentId/replies', () => {
  it('returns 200 and empty array when no replies', async () => {
    const res = await request(app).get(`/api/v1/comments/${commentId}/replies`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('returns replies sorted oldest first', async () => {
    await request(app)
      .post(`/api/v1/comments/${commentId}/replies`)
      .set('Authorization', `Bearer ${token}`)
      .send({ content: 'First reply' });
    await request(app)
      .post(`/api/v1/comments/${commentId}/replies`)
      .set('Authorization', `Bearer ${token}`)
      .send({ content: 'Second reply' });

    const res = await request(app).get(`/api/v1/comments/${commentId}/replies`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0].content).toBe('First reply');
    expect(res.body[1].content).toBe('Second reply');
  });
});

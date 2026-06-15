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

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

afterEach(async () => {
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
        author: { id: userId.toString() },
      }),
    ]);
  });
});

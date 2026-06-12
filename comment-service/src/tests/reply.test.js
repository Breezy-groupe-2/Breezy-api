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

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

beforeEach(async () => {
  await Comment.deleteMany({});
  await Reply.deleteMany({});

  const comment = await Comment.create({ content: 'A comment', postId, author: userId });
  commentId = comment._id.toString();
});

describe('POST /api/comments/:commentId/replies', () => {
  it('returns 201 and created reply', async () => {
    const res = await request(app)
      .post(`/api/comments/${commentId}/replies`)
      .set('Authorization', `Bearer ${token}`)
      .send({ content: 'A reply' });

    expect(res.status).toBe(201);
    expect(res.body.content).toBe('A reply');
    expect(res.body.commentId).toBe(commentId);
  });

  it('returns 404 when comment does not exist', async () => {
    const fakeId = new mongoose.Types.ObjectId();
    const res = await request(app)
      .post(`/api/comments/${fakeId}/replies`)
      .set('Authorization', `Bearer ${token}`)
      .send({ content: 'A reply' });

    expect(res.status).toBe(404);
  });

  it('returns 401 when not authenticated', async () => {
    const res = await request(app)
      .post(`/api/comments/${commentId}/replies`)
      .send({ content: 'A reply' });

    expect(res.status).toBe(401);
  });
});

describe('GET /api/comments/:commentId/replies', () => {
  it('returns 200 and empty array when no replies', async () => {
    const res = await request(app).get(`/api/comments/${commentId}/replies`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('returns replies sorted oldest first', async () => {
    await request(app)
      .post(`/api/comments/${commentId}/replies`)
      .set('Authorization', `Bearer ${token}`)
      .send({ content: 'First reply' });
    await request(app)
      .post(`/api/comments/${commentId}/replies`)
      .set('Authorization', `Bearer ${token}`)
      .send({ content: 'Second reply' });

    const res = await request(app).get(`/api/comments/${commentId}/replies`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0].content).toBe('First reply');
    expect(res.body[1].content).toBe('Second reply');
  });
});

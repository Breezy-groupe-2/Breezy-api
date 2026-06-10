const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const request = require('supertest');
const app = require('../app');
const User = require('../models/user.model');
const Post = require('../models/post.model');

let mongod;
let tokenA;
let tokenB;
let userAId;
let userBId;

process.env.JWT_SECRET = 'test_secret';

const userA = { username: 'userA', email: 'a@example.com', password: 'Password123' };
const userB = { username: 'userB', email: 'b@example.com', password: 'Password123' };

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
  await Post.deleteMany({});

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
});

describe('GET /api/v1/feed', () => {
  it('returns 200 and empty array when not following anyone', async () => {
    const res = await request(app).get('/api/v1/feed').set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('returns posts from followed users sorted newest first', async () => {
    await User.findByIdAndUpdate(userAId, { following: [userBId] });

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
});

const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const request = require('supertest');
const {
  app,
  models,
  mongoose: authMongoose,
} = require('../../../auth-service/src/tests/helpers/api-test-utils');

const { Like, Post, User } = models;

let mongod;
let tokenA;
let tokenB;
let tokenC;
let postId;

process.env.JWT_SECRET = 'test_secret';

const userA = { username: 'userA', email: 'a@example.com', password: 'Password123' };
const userB = { username: 'userB', email: 'b@example.com', password: 'Password123' };
const userC = { username: 'userC', email: 'c@example.com', password: 'Password123' };

const originalFetch = global.fetch;

beforeAll(async () => {
  global.fetch = async () => ({
    ok: true,
    status: 200,
    json: async () => ({ isActive: true }),
  });
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
  await Like.deleteMany({});

  await request(app).post('/api/v1/auth/register').send(userA);
  const resA = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: userA.email, password: userA.password });
  tokenA = resA.body.token;

  await request(app).post('/api/v1/auth/register').send(userB);
  const resB = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: userB.email, password: userB.password });
  tokenB = resB.body.token;

  await request(app).post('/api/v1/auth/register').send(userC);
  const resC = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: userC.email, password: userC.password });
  tokenC = resC.body.token;

  const postRes = await request(app)
    .post('/api/v1/posts')
    .set('Authorization', `Bearer ${tokenA}`)
    .send({ content: 'A post to like' });
  postId = postRes.body.id;
});

describe('POST /api/v1/posts/:id/like', () => {
  it('returns 200 and likeCount 1 on first like', async () => {
    const res = await request(app)
      .post(`/api/v1/posts/${postId}/like`)
      .set('Authorization', `Bearer ${tokenB}`);

    expect(res.status).toBe(200);
    expect(res.body.likeCount).toBe(1);
  });

  it('returns 409 on duplicate like', async () => {
    await request(app)
      .post(`/api/v1/posts/${postId}/like`)
      .set('Authorization', `Bearer ${tokenB}`);
    const res = await request(app)
      .post(`/api/v1/posts/${postId}/like`)
      .set('Authorization', `Bearer ${tokenB}`);

    expect(res.status).toBe(409);
  });

  it('returns 404 when post does not exist', async () => {
    const fakeId = new mongoose.Types.ObjectId();
    const res = await request(app)
      .post(`/api/v1/posts/${fakeId}/like`)
      .set('Authorization', `Bearer ${tokenB}`);

    expect(res.status).toBe(404);
  });

  it('returns 401 when not authenticated', async () => {
    const res = await request(app).post(`/api/v1/posts/${postId}/like`);
    expect(res.status).toBe(401);
  });
});

describe('DELETE /api/v1/posts/:id/like', () => {
  it('returns 200 and likeCount 0 after unlike', async () => {
    await request(app)
      .post(`/api/v1/posts/${postId}/like`)
      .set('Authorization', `Bearer ${tokenB}`);
    const res = await request(app)
      .delete(`/api/v1/posts/${postId}/like`)
      .set('Authorization', `Bearer ${tokenB}`);

    expect(res.status).toBe(200);
    expect(res.body.likeCount).toBe(0);
  });

  it('returns 200 even if not previously liked', async () => {
    const res = await request(app)
      .delete(`/api/v1/posts/${postId}/like`)
      .set('Authorization', `Bearer ${tokenB}`);

    expect(res.status).toBe(200);
    expect(res.body.likeCount).toBe(0);
  });

  it('returns 401 when not authenticated', async () => {
    const res = await request(app).delete(`/api/v1/posts/${postId}/like`);
    expect(res.status).toBe(401);
  });

  it('counts two different users liking the same post, then one unliking', async () => {
    const first = await request(app)
      .post(`/api/v1/posts/${postId}/like`)
      .set('Authorization', `Bearer ${tokenB}`);
    const second = await request(app)
      .post(`/api/v1/posts/${postId}/like`)
      .set('Authorization', `Bearer ${tokenC}`);
    const unlike = await request(app)
      .delete(`/api/v1/posts/${postId}/like`)
      .set('Authorization', `Bearer ${tokenB}`);

    expect(first.status).toBe(200);
    expect(first.body.likeCount).toBe(1);
    expect(second.status).toBe(200);
    expect(second.body.likeCount).toBe(2);
    expect(unlike.status).toBe(200);
    expect(unlike.body.likeCount).toBe(1);
  });
});

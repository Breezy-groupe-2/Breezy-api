const request = require('supertest');
const { app, models, setupAcceptanceDb } = require('./helpers/api-test-utils');

const { Follow, Post, User } = models;

setupAcceptanceDb();

let tokenA;
let tokenB;
let userAId;
let userBId;

const userA = { username: 'userA', email: 'a@example.com', password: 'Password123' };
const userB = { username: 'userB', email: 'b@example.com', password: 'Password123' };

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

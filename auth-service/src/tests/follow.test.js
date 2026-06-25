const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const request = require('supertest');
const app = require('../app');
const User = require('../models/user.model');

let mongod;
let tokenA;
let userAId, userBId;

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
  userBId = resB.body.user.id;
});

describe('auth-service follow route ownership', () => {
  it('does not expose relationship routes under auth paths', async () => {
    const create = await request(app)
      .post(`/api/v1/auth/${userBId}/follow`)
      .set('Authorization', `Bearer ${tokenA}`);
    const remove = await request(app)
      .delete(`/api/v1/auth/${userBId}/follow`)
      .set('Authorization', `Bearer ${tokenA}`);
    const followers = await request(app).get(`/api/v1/auth/${userBId}/followers`);
    const following = await request(app).get(`/api/v1/auth/${userAId}/following`);

    expect(create.status).toBe(404);
    expect(remove.status).toBe(404);
    expect(followers.status).toBe(404);
    expect(following.status).toBe(404);
  });
});

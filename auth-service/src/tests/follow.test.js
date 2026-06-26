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
  it('requires the internal service token for follow sync mutations', async () => {
    const missing = await request(app).put(`/internal/users/${userAId}/following/${userBId}`);
    const invalid = await request(app)
      .delete(`/internal/users/${userAId}/following/${userBId}`)
      .set('x-internal-service-token', 'wrong-token');

    expect(missing.status).toBe(401);
    expect(invalid.status).toBe(401);
  });

  it('allows follow sync mutations with the internal service token', async () => {
    const create = await request(app)
      .put(`/internal/users/${userAId}/following/${userBId}`)
      .set('x-internal-service-token', 'test_internal_service_token');
    const afterCreate = await User.findById(userAId);
    const remove = await request(app)
      .delete(`/internal/users/${userAId}/following/${userBId}`)
      .set('x-internal-service-token', 'test_internal_service_token');
    const afterRemove = await User.findById(userAId);

    expect(create.status).toBe(204);
    expect(afterCreate.following.map((id) => id.toString())).toContain(userBId);
    expect(remove.status).toBe(204);
    expect(afterRemove.following.map((id) => id.toString())).not.toContain(userBId);
  });

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

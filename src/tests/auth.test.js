const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const request = require('supertest');
const app = require('../app');
const User = require('../models/user.model');

let mongod;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

afterEach(async () => {
  await User.deleteMany({});
});

const validPayload = {
  username: 'testuser',
  email: 'test@example.com',
  password: 'Password123',
};

describe('POST /api/v1/auth/register', () => {
  it('returns 201 and user data on valid input', async () => {
    const res = await request(app).post('/api/v1/auth/register').send(validPayload);

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ username: 'testuser', email: 'test@example.com', role: 'user' });
    expect(res.body).not.toHaveProperty('passwordHash');
  });

  it('returns 400 when username is too short', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ ...validPayload, username: 'ab' });

    expect(res.status).toBe(400);
    expect(res.body.details[0].field).toBe('username');
  });

  it('returns 400 for invalid email', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ ...validPayload, email: 'not-an-email' });

    expect(res.status).toBe(400);
    expect(res.body.details[0].field).toBe('email');
  });

  it('returns 400 when password is too short', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ ...validPayload, password: 'short' });

    expect(res.status).toBe(400);
    expect(res.body.details[0].field).toBe('password');
  });

  it('returns 409 on duplicate email', async () => {
    await request(app).post('/api/v1/auth/register').send(validPayload);
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ ...validPayload, username: 'otheruser' });

    expect(res.status).toBe(409);
  });

  it('returns 409 on duplicate username', async () => {
    await request(app).post('/api/v1/auth/register').send(validPayload);
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ ...validPayload, email: 'other@example.com' });

    expect(res.status).toBe(409);
  });
});

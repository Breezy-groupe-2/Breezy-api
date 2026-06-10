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

process.env.JWT_SECRET = 'test_secret';

const validPayload = {
  username: 'testuser',
  email: 'test@example.com',
  password: 'Password123',
};

describe('POST /api/v1/auth/register', () => {
  it('returns 201 and user data on valid input', async () => {
    const res = await request(app).post('/api/v1/auth/register').send(validPayload);

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('token');
    expect(res.body.user).toMatchObject({
      username: 'testuser',
      email: 'test@example.com',
      role: 'user',
    });
    expect(res.body.user).not.toHaveProperty('passwordHash');
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

describe('POST /api/v1/auth/login', () => {
  beforeEach(async () => {
    await request(app).post('/api/v1/auth/register').send(validPayload);
  });

  it('returns 200 and a JWT token on valid credentials', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: validPayload.email, password: validPayload.password });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
    expect(res.body.user).toMatchObject({ email: validPayload.email, role: 'user' });
    expect(res.body.user).not.toHaveProperty('passwordHash');
  });

  it('returns 401 on wrong password', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: validPayload.email, password: 'WrongPass1' });

    expect(res.status).toBe(401);
  });

  it('returns 401 for unknown email', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'nobody@example.com', password: validPayload.password });

    expect(res.status).toBe(401);
  });
});

describe('GET /api/v1/auth/me', () => {
  let token;

  beforeEach(async () => {
    await request(app).post('/api/v1/auth/register').send(validPayload);
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: validPayload.email, password: validPayload.password });
    token = res.body.token;
  });

  it('returns 200 and current user when authenticated', async () => {
    const res = await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ username: validPayload.username, email: validPayload.email });
  });

  it('returns 200 for the users/me alias used by the web client', async () => {
    const res = await request(app)
      .get('/api/v1/users/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ username: validPayload.username, email: validPayload.email });
  });

  it('returns 401 when no token is provided', async () => {
    const res = await request(app).get('/api/v1/auth/me');
    expect(res.status).toBe(401);
  });

  it('returns 401 on invalid token', async () => {
    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', 'Bearer invalidtoken');
    expect(res.status).toBe(401);
  });
});

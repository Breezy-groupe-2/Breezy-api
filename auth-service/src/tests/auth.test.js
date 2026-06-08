const request = require('supertest');
const app = require('../index');
const sequelize = require('../config/database');
const User = require('../models/User');

beforeAll(async () => {
  await sequelize.sync({ force: true });
});

afterAll(async () => {
  await sequelize.close();
});

afterEach(async () => {
  await User.destroy({ truncate: true, cascade: true });
});

describe('POST /auth/register', () => {
  const validPayload = {
    username: 'testuser',
    email: 'test@example.com',
    password: 'Password123',
  };

  it('registers a new user and returns 201', async () => {
    const res = await request(app).post('/auth/register').send(validPayload);

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      username: 'testuser',
      email: 'test@example.com',
      role: 'user',
    });
    expect(res.body).not.toHaveProperty('password_hash');
  });

  it('returns 400 when username is too short', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({ ...validPayload, username: 'ab' });

    expect(res.status).toBe(400);
    expect(res.body.details[0].field).toBe('username');
  });

  it('returns 400 for invalid email', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({ ...validPayload, email: 'not-an-email' });

    expect(res.status).toBe(400);
    expect(res.body.details[0].field).toBe('email');
  });

  it('returns 400 when password is too short', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({ ...validPayload, password: 'short' });

    expect(res.status).toBe(400);
    expect(res.body.details[0].field).toBe('password');
  });

  it('returns 409 on duplicate email', async () => {
    await request(app).post('/auth/register').send(validPayload);
    const res = await request(app)
      .post('/auth/register')
      .send({ ...validPayload, username: 'other' });

    expect(res.status).toBe(409);
  });

  it('returns 409 on duplicate username', async () => {
    await request(app).post('/auth/register').send(validPayload);
    const res = await request(app)
      .post('/auth/register')
      .send({ ...validPayload, email: 'other@example.com' });

    expect(res.status).toBe(409);
  });
});

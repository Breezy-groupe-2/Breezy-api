const request = require('supertest');
const app = require('../app');

describe('Swagger Service', () => {
  it('GET /health returns 200 and status', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'Swagger Service is running' });
  });

  it('GET / redirects to /api-docs', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/api-docs');
  });

  it('GET /api-docs/ returns 200 and serves HTML', async () => {
    const res = await request(app).get('/api-docs/');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/html');
  });
});

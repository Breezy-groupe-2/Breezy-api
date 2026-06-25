const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const request = require('supertest');
const jwt = require('jsonwebtoken');

process.env.S3_ENDPOINT = 'http://localhost:9000';
process.env.S3_ACCESS_KEY_ID = 'test-access-key';
process.env.S3_SECRET_ACCESS_KEY = 'test-secret-key';

const s3Client = require('../config/s3');
const app = require('../app');


let mongod;
let token;

const originalFetch = global.fetch;

const mockActiveUser = () => {
  global.fetch = async () => ({
    ok: true,
    status: 200,
    json: async () => ({ isActive: true }),
  });
};

beforeAll(async () => {
  mockActiveUser();
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
});

afterAll(async () => {
  global.fetch = originalFetch;
  await mongoose.disconnect();
  await mongod.stop();
});

beforeEach(async () => {
  mockActiveUser();
  token = jwt.sign({ sub: new mongoose.Types.ObjectId().toString(), role: 'user' }, 'test_secret', {
    expiresIn: '15m',
  });
  vi.spyOn(s3Client, 'send').mockResolvedValue({});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('media routes', () => {
  it('successfully uploads an image and returns public URL', async () => {
    const res = await request(app)
      .post('/api/v1/media/upload')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', Buffer.from('fake image data'), 'test.png');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('url');
    expect(res.body.url).toContain('/breezy-media/');
    expect(res.body.url).toContain('.png');

    // Vérifie que la commande d'upload S3 a été appelée
    expect(s3Client.send).toHaveBeenCalled();
    const sentCommand = vi.mocked(s3Client.send).mock.calls[0][0];
    expect(sentCommand.input.Bucket).toBe('breezy-media');
    expect(sentCommand.input.ContentType).toBe('image/png');
  });

  it('returns 400 when file is missing', async () => {
    const res = await request(app)
      .post('/api/v1/media/upload')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('No file uploaded');
  });

  it('returns 400 when file is not an image', async () => {
    const res = await request(app)
      .post('/api/v1/media/upload')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', Buffer.from('fake text data'), 'test.txt');

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Only image files are allowed');
  });

  it('returns 401 when unauthenticated', async () => {
    const res = await request(app)
      .post('/api/v1/media/upload')
      .attach('file', Buffer.from('fake image data'), 'test.png');

    expect(res.status).toBe(401);
  });
});

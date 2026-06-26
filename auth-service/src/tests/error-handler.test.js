const {
  DEFAULT_INTERNAL_ERROR_MESSAGE,
  errorHandler,
  getStatusCode,
} = require('../shared/error-handler');

const createResponse = () => {
  const res = {
    body: undefined,
    statusCode: undefined,
    status: vi.fn((statusCode) => {
      res.statusCode = statusCode;
      return res;
    }),
    json: vi.fn((body) => {
      res.body = body;
      return res;
    }),
  };

  return res;
};

describe('errorHandler', () => {
  let consoleError;

  beforeEach(() => {
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleError.mockRestore();
  });

  it('preserves deliberate 4xx messages and details', () => {
    const err = new Error('Validation failed');
    err.status = 400;
    err.details = [{ field: 'content', message: 'Content is required' }];
    const res = createResponse();

    errorHandler(err, {}, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.body).toEqual({
      error: 'Validation failed',
      details: [{ field: 'content', message: 'Content is required' }],
    });
    expect(consoleError).toHaveBeenCalledWith(err);
  });

  it('hides unexpected 5xx messages from responses', () => {
    const err = new Error('database password leaked in stack context');
    const res = createResponse();

    errorHandler(err, {}, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.body).toEqual({ error: DEFAULT_INTERNAL_ERROR_MESSAGE });
    expect(consoleError).toHaveBeenCalledWith(err);
  });
});

describe('getStatusCode', () => {
  it('falls back to 500 for invalid status values', () => {
    expect(getStatusCode({ status: 200 })).toBe(500);
    expect(getStatusCode({ status: 700 })).toBe(500);
    expect(getStatusCode({})).toBe(500);
  });

  it('accepts valid status and statusCode values', () => {
    expect(getStatusCode({ status: 404 })).toBe(404);
    expect(getStatusCode({ statusCode: 503 })).toBe(503);
  });
});

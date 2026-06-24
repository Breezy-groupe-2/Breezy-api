// Unit tests sign their own JWTs with the dev fallback secret ("test_secret")
// and mock the auth-service verification over fetch. Each service's
// config/env.js calls dotenv.config(), so the repo's local .env would otherwise
// leak a real JWT_SECRET into the test process and break token verification
// (every authenticated request 401s). Pin the secret to keep tests isolated.
process.env.JWT_SECRET = 'test_secret';

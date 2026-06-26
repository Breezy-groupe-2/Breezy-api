const { S3Client } = require('@aws-sdk/client-s3');
const { env } = require('./env');

const s3Client = new S3Client({
  endpoint: env.s3.endpoint,
  region: 'us-east-1', // Required by the SDK, but ignored by local MinIO
  credentials: {
    accessKeyId: env.s3.accessKeyId,
    secretAccessKey: env.s3.secretAccessKey,
  },
  forcePathStyle: true, // Required for local MinIO / path-style storage
});

module.exports = s3Client;

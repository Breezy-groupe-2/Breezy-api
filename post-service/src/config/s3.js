const { S3Client } = require('@aws-sdk/client-s3');

const s3Client = new S3Client({
  endpoint: process.env.S3_ENDPOINT || 'http://localhost:9000',
  region: 'us-east-1', // Required by the SDK, but ignored by local MinIO
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID || 'breezy_minio_user',
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || 'breezy_minio_password',
  },
  forcePathStyle: true, // Required for local MinIO / path-style storage
});

module.exports = s3Client;

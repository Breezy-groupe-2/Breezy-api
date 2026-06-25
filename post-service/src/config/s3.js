const { S3Client } = require('@aws-sdk/client-s3');

const s3Client = new S3Client({
  endpoint: process.env.S3_ENDPOINT || 'http://localhost:9000',
  region: 'us-east-1', // Requis par le SDK, mais ignoré par MinIO local
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID || 'breezy_minio_user',
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || 'breezy_minio_password',
  },
  forcePathStyle: true, // Obligatoire pour MinIO / stockage local
});

module.exports = s3Client;

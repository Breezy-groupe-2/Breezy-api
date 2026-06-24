const { S3Client } = require('@aws-sdk/client-s3');

const endpoint = process.env.S3_ENDPOINT;
const accessKeyId = process.env.S3_ACCESS_KEY_ID;
const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;

if (!endpoint || !accessKeyId || !secretAccessKey) {
  const missing = ['S3_ENDPOINT', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY']
    .filter((k) => !process.env[k]);
  throw new Error(`Invalid S3 configuration: missing ${missing.join(', ')}`);
}

const s3Client = new S3Client({
  endpoint,
  region: 'us-east-1',
  credentials: { accessKeyId, secretAccessKey },
  forcePathStyle: true,
});

module.exports = s3Client;

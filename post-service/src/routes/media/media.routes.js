const { Router } = require('express');
const multer = require('multer');
const { PutObjectCommand } = require('@aws-sdk/client-s3');
const crypto = require('crypto');
const path = require('path');
const s3Client = require('../../config/s3');
const { authenticate } = require('../../middlewares/authenticate');

const router = Router();

/**
 * @openapi
 * /media/upload:
 *   post:
 *     summary: Upload a media file (image)
 *     description: Uploads a media file to the S3 bucket and returns the public URL. Authentication required.
 *     tags: [Media]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [file]
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: The image file to upload (mime type image/*)
 *     responses:
 *       200:
 *         description: File uploaded successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 url:
 *                   type: string
 *                   format: uri
 *                   example: http://localhost:3000/breezy-media/7be6b208-1fcb-4ca2-b91c-16478be32fb4.png
 *       400:
 *         description: Validation failed (file missing or incorrect format)
 *       401:
 *         description: Unauthorized
 */

// Multer in-memory storage configuration
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept only image/* formats required by the frontend
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image files are allowed'), false);
    }
    cb(null, true);
  },
});

router.post(
  '/upload',
  authenticate,
  (req, res, next) => {
    upload.single('file')(req, res, (err) => {
      if (err) {
        err.status = 400;
        return next(err);
      }
      next();
    });
  },
  async (req, res, next) => {
    try {
      if (!req.file) {
        const err = new Error('No file uploaded');
        err.status = 400;
        return next(err);
      }

      const file = req.file;
      const fileExt = path.extname(file.originalname) || '.jpg';
      const uniqueFilename = `${crypto.randomUUID()}${fileExt}`;

      const bucketName = process.env.S3_BUCKET_NAME || 'breezy-media';
      const publicUrlBase = process.env.S3_PUBLIC_URL || 'http://localhost:3000/breezy-media';

      const uploadParams = {
        Bucket: bucketName,
        Key: uniqueFilename,
        Body: file.buffer,
        ContentType: file.mimetype,
      };

      await s3Client.send(new PutObjectCommand(uploadParams));

      const fileUrl = `${publicUrlBase}/${uniqueFilename}`;
      res.status(200).json({ url: fileUrl });
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;

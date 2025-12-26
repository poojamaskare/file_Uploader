const express = require('express');
const multer = require('multer');
const { Readable } = require('stream');
const { ObjectId } = require('mongodb');
const { getBucket } = require('../config/mongo');
const { validationResult, param } = require('express-validator');

const router = express.Router();

// Multer setup: memory storage with limits and mime type validation
const storage = multer.memoryStorage();
const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE || '10485760', 10); // 10MB default
const DEFAULT_ALLOWED_MIME = ['image/png', 'image/jpeg', 'application/pdf', 'text/plain'];
const ALLOWED_MIME = (process.env.ALLOWED_MIME || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (req, file, cb) => {
    const allowed = ALLOWED_MIME.length ? ALLOWED_MIME : DEFAULT_ALLOWED_MIME;
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(Object.assign(new Error(`Unsupported file type: ${file.mimetype}`), { status: 400 }));
  },
});

function handleValidationErrors(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Invalid request parameters', details: errors.array() });
  }
  next();
}

// Upload a file to GridFS
router.post('/', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded. Use field name "file".' });
    }
    const bucket = getBucket();
    const uploadStream = bucket.openUploadStream(req.file.originalname, {
      contentType: req.file.mimetype,
      metadata: { size: req.file.size, uploadedBy: req.ip },
    });

    Readable.from(req.file.buffer)
      .pipe(uploadStream)
      .on('error', (err) => next(err))
      .on('finish', async () => {
        try {
          const fileId = uploadStream.id;
          const docs = await bucket.find({ _id: fileId }).toArray();
          const doc = docs[0] || {};
          return res.status(201).json({
            id: fileId,
            filename: doc.filename || req.file.originalname,
            contentType: doc.contentType || req.file.mimetype,
            length: doc.length || req.file.size,
            uploadDate: doc.uploadDate || new Date(),
          });
        } catch (e) {
          return res.status(201).json({ id: uploadStream.id, filename: req.file.originalname });
        }
      });
  } catch (err) {
    next(err);
  }
});

// Download a file by ObjectId
router.get(
  '/:id',
  param('id').isMongoId().withMessage('id must be a valid MongoDB ObjectId'),
  handleValidationErrors,
  async (req, res, next) => {
    try {
      const oid = new ObjectId(req.params.id);
      const bucket = getBucket();
      const docs = await bucket.find({ _id: oid }).toArray();
      const file = docs[0];
      if (!file) return res.status(404).json({ error: 'File not found' });

      res.set({
        'Content-Type': file.contentType || 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${file.filename}"`,
      });

      const stream = bucket.openDownloadStream(oid);
      stream.on('error', (err) => next(err));
      stream.pipe(res);
    } catch (err) {
      next(err);
    }
  }
);

// Delete a file by ObjectId
router.delete(
  '/:id',
  param('id').isMongoId().withMessage('id must be a valid MongoDB ObjectId'),
  handleValidationErrors,
  async (req, res, next) => {
    try {
      const oid = new ObjectId(req.params.id);
      const bucket = getBucket();
      await bucket.delete(oid);
      return res.json({ deleted: true, id: oid.toString() });
    } catch (err) {
      // Map not-found to 404 if possible
      const msg = String(err && err.message || '').toLowerCase();
      if (msg.includes('not found')) return res.status(404).json({ error: 'File not found' });
      next(err);
    }
  }
);

// Optional: list recent files (useful for debugging)
router.get('/', async (req, res, next) => {
  try {
    const bucket = getBucket();
    const limit = Math.min(parseInt(req.query.limit || '20', 10), 100);
    const files = await bucket
      .find({}, { sort: { uploadDate: -1 } })
      .limit(limit)
      .toArray();
    res.json(
      files.map((f) => ({
        id: f._id,
        filename: f.filename,
        contentType: f.contentType,
        length: f.length,
        uploadDate: f.uploadDate,
      }))
    );
  } catch (err) {
    next(err);
  }
});

module.exports = router;

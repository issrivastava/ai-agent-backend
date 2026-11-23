import type { RequestHandler } from 'express';
import multer from 'multer';
import { HttpError } from '../../utils/http-error';

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED = new Set(['application/pdf', 'image/png', 'image/jpeg']);

const upload = multer({
  storage: multer.memoryStorage(), // the bytes are validated, not stored (see note above)
  limits: { fileSize: MAX_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED.has(file.mimetype)) {
      return cb(HttpError.badRequest('Only PDF, PNG and JPG files are allowed'));
    }
    cb(null, true);
  },
});

/** Reads one file from the form field "file" and turns multer errors into 400s. */
export const uploadSingleFile: RequestHandler = (req, res, next) => {
  upload.single('file')(req, res, (err: unknown) => {
    if (!err) return next();
    if (err instanceof multer.MulterError) {
      const message =
        err.code === 'LIMIT_FILE_SIZE' ? 'File is too large (10 MB maximum)' : 'Invalid upload';
      return next(HttpError.badRequest(message));
    }
    next(err);
  });
};
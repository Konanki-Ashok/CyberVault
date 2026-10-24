import multer from 'multer';
import { ZodError } from 'zod';

export function errorHandler(err, req, res, next) {
  console.error('[Error Handler]', err);

  // Multer errors (e.g. file size limit exceeded)
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        error: 'File size exceeds maximum permitted limit (15MB).',
      });
    }
    return res.status(400).json({
      success: false,
      error: `File upload error: ${err.message}`,
    });
  }

  // Zod validation errors
  if (err instanceof ZodError) {
    const formatted = err.errors.map((e) => ({
      field: e.path.join('.'),
      message: e.message,
    }));
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: formatted,
    });
  }

  const statusCode = err.statusCode || 500;
  const message = statusCode === 500 && process.env.NODE_ENV === 'production'
    ? 'An internal server error occurred.'
    : err.message || 'Unknown error occurred.';

  res.status(statusCode).json({
    success: false,
    error: message,
  });
}

import multer from 'multer';
import { MAX_FILE_SIZE } from '../constants/index.js';
import { validateFileBuffer } from '../utils/magicBytes.js';
import { sanitizeFilename } from '../utils/sanitize.js';

const storage = multer.memoryStorage();

export const upload = multer({
  storage,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 1,
  },
});

/**
 * Validates the uploaded file buffer against:
 * 1. Allowlist
 * 2. Magic bytes
 * 3. Executable signatures
 * 4. Filename sanitization
 */
export function validateUploadedFile(req, res, next) {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      error: 'No file uploaded. Please provide a file.',
    });
  }

  // 1. Sanitize the user-provided filename
  const rawFilename = req.file.originalname || 'document';
  const cleanFilename = sanitizeFilename(rawFilename);
  req.file.sanitizedFilename = cleanFilename;

  // 2. Validate magic bytes and format
  const validation = validateFileBuffer(
    req.file.buffer,
    cleanFilename,
    req.file.mimetype
  );

  if (!validation.valid) {
    return res.status(400).json({
      success: false,
      error: validation.error,
    });
  }

  next();
}

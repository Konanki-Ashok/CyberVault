import path from 'path';

/**
 * Sanitizes user-provided filename:
 * - strips path traversal (../, ..\)
 * - strips null bytes and control characters
 * - replaces dangerous characters
 * - enforces length limits
 */
export function sanitizeFilename(filename) {
  if (!filename || typeof filename !== 'string') {
    return 'unnamed_file';
  }

  // Remove null bytes
  let clean = filename.replace(/\0/g, '');

  // Extract base filename (removes directory components)
  clean = path.basename(clean);

  // Strip control characters and dangerous shell/fs characters
  clean = clean.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_');

  // Collapse multiple underscores or spaces
  clean = clean.replace(/_{2,}/g, '_').trim();

  // If filename begins with dot, prepend underscore to prevent hidden file behavior
  if (clean.startsWith('.')) {
    clean = '_' + clean;
  }

  // Limit filename length to 200 chars while preserving extension
  const ext = path.extname(clean);
  const base = path.basename(clean, ext);
  if (clean.length > 200) {
    clean = base.slice(0, 190) + ext;
  }

  return clean || 'document';
}

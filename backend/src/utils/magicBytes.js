import { ALLOWED_FILE_TYPES } from '../constants/index.js';
import path from 'path';

// Known dangerous executable/script signatures to explicitly reject
const EXECUTABLE_SIGNATURES = [
  { name: 'Windows PE / EXE / DLL', bytes: [0x4D, 0x5A] }, // MZ
  { name: 'Linux ELF', bytes: [0x7F, 0x45, 0x4C, 0x46] }, // \x7FELF
  { name: 'Shell Script Shebang', bytes: [0x23, 0x21] }, // #!
  { name: 'Java Class / Mach-O Fat', bytes: [0xCA, 0xFE, 0xBA, 0xBE] },
  { name: 'Mach-O 32-bit', bytes: [0xFE, 0xED, 0xFA, 0xCE] },
  { name: 'Mach-O 64-bit', bytes: [0xFE, 0xED, 0xFA, 0xCF] },
  { name: 'Mach-O 32-bit reverse', bytes: [0xCE, 0xFA, 0xED, 0xFE] },
  { name: 'Mach-O 64-bit reverse', bytes: [0xCF, 0xFA, 0xED, 0xFE] },
];

/**
 * Validates a file buffer against:
 * 1. Executable magic signatures
 * 2. Claimed MIME type
 * 3. Filename extension
 * 4. Actual file signature (magic bytes)
 */
export function validateFileBuffer(buffer, originalFilename, claimedMimeType) {
  if (!buffer || buffer.length === 0) {
    return { valid: false, error: 'File is empty.' };
  }

  // 1. Check for executable signatures
  for (const exe of EXECUTABLE_SIGNATURES) {
    if (buffer.length >= exe.bytes.length) {
      const match = exe.bytes.every((byte, idx) => buffer[idx] === byte);
      if (match) {
        return {
          valid: false,
          error: `Executable files (${exe.name}) are strictly forbidden for security reasons.`,
        };
      }
    }
  }

  // 2. Check extension and claimed MIME against allowlist
  const ext = path.extname(originalFilename).toLowerCase();
  const allowedType = ALLOWED_FILE_TYPES[claimedMimeType];

  if (!allowedType) {
    return {
      valid: false,
      error: `Disallowed MIME type: ${claimedMimeType}. Permitted types: PDF, PNG, JPEG, DOCX, TXT, JSON.`,
    };
  }

  if (!allowedType.exts.includes(ext)) {
    return {
      valid: false,
      error: `File extension ${ext} does not match claimed MIME type ${claimedMimeType}.`,
    };
  }

  // 3. Verify magic bytes for types with signatures (PDF, PNG, JPEG, DOCX)
  if (allowedType.magic.length > 0) {
    const matchesSignature = allowedType.magic.some((signature) => {
      if (buffer.length < signature.length) return false;
      return signature.every((byte, i) => buffer[i] === byte);
    });

    if (!matchesSignature) {
      return {
        valid: false,
        error: `MIME type spoofing detected: File content does not match signature for ${claimedMimeType}.`,
      };
    }
  } else if (claimedMimeType === 'text/plain') {
    // For text/plain, check for null bytes which indicate binary data
    const checkLength = Math.min(buffer.length, 1024);
    for (let i = 0; i < checkLength; i++) {
      if (buffer[i] === 0x00) {
        return {
          valid: false,
          error: 'MIME type spoofing detected: Plain text file contains binary null bytes.',
        };
      }
    }
  } else if (claimedMimeType === 'application/json') {
    try {
      JSON.parse(buffer.toString('utf8'));
    } catch {
      return {
        valid: false,
        error: 'Invalid JSON file: Content cannot be parsed as valid JSON.',
      };
    }
  }

  return { valid: true };
}

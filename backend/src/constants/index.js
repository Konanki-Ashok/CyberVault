export const ROLES = {
  ADMIN: 'admin',
  OWNER: 'owner',
  VIEWER: 'viewer',
};

export const PERMISSIONS = {
  READ: 'read',
  EDIT: 'edit',
};

export const USER_STATUS = {
  ACTIVE: 'active',
  DISABLED: 'disabled',
};

export const AUDIT_ACTIONS = {
  AUTH_REGISTER: 'AUTH_REGISTER',
  AUTH_LOGIN_SUCCESS: 'AUTH_LOGIN_SUCCESS',
  AUTH_LOGIN_FAILED: 'AUTH_LOGIN_FAILED',
  AUTH_LOGOUT: 'AUTH_LOGOUT',
  SESSION_REVOKED: 'SESSION_REVOKED',
  USER_STATUS_CHANGED: 'USER_STATUS_CHANGED',
  DOC_UPLOAD: 'DOC_UPLOAD',
  DOC_METADATA_UPDATE: 'DOC_METADATA_UPDATE',
  DOC_DOWNLOAD: 'DOC_DOWNLOAD',
  DOC_PREVIEW: 'DOC_PREVIEW',
  DOC_DELETE: 'DOC_DELETE',
  DOC_ACCESS_DENIED: 'DOC_ACCESS_DENIED',
  ACL_GRANT: 'ACL_GRANT',
  ACL_REVOKE: 'ACL_REVOKE',
  AI_RECIPIENT_RECOMMENDATION: 'AI_RECIPIENT_RECOMMENDATION',
  AI_RECOMMENDATION_DECISION: 'AI_RECOMMENDATION_DECISION',
  AUDIT_VERIFY: 'AUDIT_VERIFY',
};

export const AUDIT_OUTCOMES = {
  SUCCESS: 'SUCCESS',
  DENIED: 'DENIED',
  FAILED: 'FAILED',
};

export const ALLOWED_FILE_TYPES = {
  'application/pdf': {
    exts: ['.pdf'],
    magic: [[0x25, 0x50, 0x44, 0x46]], // %PDF
  },
  'image/png': {
    exts: ['.png'],
    magic: [[0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]],
  },
  'image/jpeg': {
    exts: ['.jpg', '.jpeg'],
    magic: [
      [0xFF, 0xD8, 0xFF, 0xE0],
      [0xFF, 0xD8, 0xFF, 0xE1],
      [0xFF, 0xD8, 0xFF, 0xEE],
      [0xFF, 0xD8, 0xFF, 0xDB],
      [0xFF, 0xD8, 0xFF],
    ],
  },
  'text/plain': {
    exts: ['.txt'],
    magic: [], // verified via text encoding / no NUL byte check
  },
  'application/json': {
    exts: ['.json'],
    magic: [], // verified via JSON parse / text
  },
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': {
    exts: ['.docx'],
    magic: [[0x50, 0x4B, 0x03, 0x04]], // PK..
  },
};

export const MAX_FILE_SIZE = 15 * 1024 * 1024; // 15MB

export const DOCUMENT_CATEGORIES = [
  'Finance',
  'Legal',
  'Engineering',
  'Human Resources',
  'Operations',
  'Security & Compliance',
  'Executive',
  'General',
];

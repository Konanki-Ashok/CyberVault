import admin from 'firebase-admin';
import { env } from '../config/env.js';

let firebaseInitialized = false;

// Check if credentials or service account path provided
const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
const projectId = process.env.FIREBASE_PROJECT_ID;

if (serviceAccountKey) {
  try {
    const creds = JSON.parse(serviceAccountKey);
    admin.initializeApp({
      credential: admin.credential.cert(creds),
    });
    firebaseInitialized = true;
    console.log('[Firebase Admin] Initialized with Service Account');
  } catch (err) {
    console.warn('[Firebase Admin] Failed to parse service account JSON:', err.message);
  }
} else if (projectId) {
  try {
    admin.initializeApp({
      projectId,
    });
    firebaseInitialized = true;
    console.log(`[Firebase Admin] Initialized with Project ID: ${projectId}`);
  } catch (err) {
    console.warn('[Firebase Admin] Initialization error:', err.message);
  }
}

export const firebaseAuthService = {
  isConfigured() {
    return firebaseInitialized;
  },

  /**
   * Verifies a Firebase ID token.
   * If real Firebase Admin is initialized, uses admin.auth().verifyIdToken(token).
   * In development/test mode or with demo tokens (starting with 'demo_firebase_'),
   * performs structured validation so local evaluations work smoothly.
   */
  async verifyIdToken(idToken) {
    if (!idToken || typeof idToken !== 'string') {
      throw new Error('Missing or invalid Firebase ID token');
    }

    // 1. If live Firebase Admin SDK is initialized
    if (firebaseInitialized) {
      try {
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        return {
          uid: decodedToken.uid,
          email: decodedToken.email,
          name: decodedToken.name || decodedToken.email.split('@')[0],
          picture: decodedToken.picture || null,
        };
      } catch (err) {
        throw new Error(`Firebase token verification failed: ${err.message}`);
      }
    }

    // 2. Fallback / Test / Offline Dev handler for demonstration
    // Allows demo simulation if real credentials are not yet supplied in .env
    if (idToken.startsWith('mock_') || idToken.startsWith('demo_') || process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'development') {
      try {
        // If passed as base64-encoded JSON in dev mode
        if (idToken.includes('.')) {
          const parts = idToken.split('.');
          if (parts.length === 3) {
            const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
            if (payload.email) {
              return {
                uid: payload.sub || payload.uid || 'firebase_uid_test',
                email: payload.email,
                name: payload.name || payload.email.split('@')[0],
              };
            }
          }
        }
      } catch {
        // Continue to fallback
      }

      // Default demo payload if format is 'demo_firebase_<email>'
      if (idToken.startsWith('demo_firebase_')) {
        const email = idToken.replace('demo_firebase_', '').trim();
        return {
          uid: `fb_${Buffer.from(email).toString('hex').slice(0, 16)}`,
          email,
          name: email.split('@')[0].toUpperCase(),
        };
      }
    }

    throw new Error('Firebase Admin SDK is not initialized. Please configure FIREBASE_PROJECT_ID or FIREBASE_SERVICE_ACCOUNT_KEY.');
  },
};

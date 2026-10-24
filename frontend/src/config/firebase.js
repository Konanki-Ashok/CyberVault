import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'demo-api-key',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'trustvault-demo.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'trustvault-demo',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'trustvault-demo.appspot.com',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '123456789',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:123456789:web:abcdef',
};

// Initialize Firebase App
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export const isFirebaseConfigured = () => {
  return !!import.meta.env.VITE_FIREBASE_API_KEY && import.meta.env.VITE_FIREBASE_API_KEY !== 'demo-api-key';
};

/**
 * Triggers Google Sign-In via Firebase.
 * If live Firebase config is present, launches standard Google popup.
 * If in demo/dev mode without configured keys, uses interactive demo token.
 */
export async function authenticateWithGoogle() {
  if (isFirebaseConfigured()) {
    const result = await signInWithPopup(auth, googleProvider);
    const idToken = await result.user.getIdToken();
    return {
      idToken,
      user: {
        email: result.user.email,
        name: result.user.displayName,
        photoURL: result.user.photoURL,
      },
    };
  } else {
    // Demonstration / Simulated Firebase token for evaluation
    const demoEmail = prompt('Enter Google Account email for Firebase authentication:', 'google.user@trustvault.local');
    if (!demoEmail) throw new Error('Google Sign-In canceled');
    return {
      idToken: `demo_firebase_${demoEmail.trim().toLowerCase()}`,
      user: {
        email: demoEmail.trim().toLowerCase(),
        name: demoEmail.split('@')[0],
      },
    };
  }
}

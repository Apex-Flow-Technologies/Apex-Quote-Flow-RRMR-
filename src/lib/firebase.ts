import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, initializeFirestore, type Firestore } from 'firebase/firestore';

export interface FirebaseConfigValidation {
  isConfigured: boolean;
  missingKeys: string[];
}

const requiredEnvKeys = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID',
] as const;

export function validateFirebaseEnv(): FirebaseConfigValidation {
  const missingKeys: string[] = [];

  for (const key of requiredEnvKeys) {
    const value = import.meta.env[key];
    if (!value || typeof value !== 'string' || value.trim() === '') {
      missingKeys.push(key);
    }
  }

  return {
    isConfigured: missingKeys.length === 0,
    missingKeys,
  };
}

const envValidation = validateFirebaseEnv();

export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
};

let app: FirebaseApp;
let auth: Auth;
let db: Firestore;

if (envValidation.isConfigured) {
  app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
  auth = getAuth(app);
  try {
    db = initializeFirestore(app, {
      ignoreUndefinedProperties: true,
    });
  } catch {
    db = getFirestore(app);
  }
} else {
  console.error(
    `[Firebase] Missing configuration environment variables: ${envValidation.missingKeys.join(
      ', '
    )}. Please check .env.local file.`
  );
  // Fallback placeholder instances or error wrappers
  app = {} as FirebaseApp;
  auth = {} as Auth;
  db = {} as Firestore;
}

export { app, auth, db, envValidation };

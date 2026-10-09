import {
  signInWithEmailAndPassword,
  signOut,
  type UserCredential,
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import type { UserProfile } from '../types';

export function formatAuthErrorMessage(errorCode: string): string {
  switch (errorCode) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Invalid email or password. Please verify your credentials.';
    case 'auth/invalid-email':
      return 'The email address is not formatted correctly.';
    case 'auth/user-disabled':
      return 'This user account has been disabled. Please contact your administrator.';
    case 'auth/too-many-requests':
      return 'Too many unsuccessful attempts. Access has been temporarily locked. Please try again later.';
    case 'auth/network-request-failed':
      return 'Network connection failed. Please check your internet connection.';
    default:
      return 'Authentication failed. Please check your credentials or contact administrator.';
  }
}

export async function loginWithEmail(
  email: string,
  pass: string
): Promise<UserCredential> {
  return await signInWithEmailAndPassword(auth, email.trim(), pass);
}

export async function logoutUser(): Promise<void> {
  await signOut(auth);
}

export async function fetchUserProfile(uid: string): Promise<UserProfile | null> {
  try {
    const userDocRef = doc(db, 'users', uid);
    const docSnap = await getDoc(userDocRef);

    if (!docSnap.exists()) {
      return null;
    }

    const data = docSnap.data();
    return {
      uid,
      email: data.email || '',
      name: data.name || 'User',
      role: (data.role === 'admin' ? 'admin' : 'sales') as UserProfile['role'],
      active: Boolean(data.active),
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    };
  } catch (error) {
    console.error(`[AuthService] Error fetching user profile for ${uid}:`, error);
    throw error;
  }
}

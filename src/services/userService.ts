/**
 * Staff account management (admin only — enforced by Firestore rules on users/{uid}).
 */
import { initializeApp, deleteApp, getApps } from 'firebase/app';
import {
  getAuth,
  createUserWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
} from 'firebase/auth';
import { collection, doc, getDocs, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db, firebaseConfig } from '../lib/firebase';
import type { UserProfile, UserRole } from '../types/user';

const USERS = 'users';

export async function listUsers(): Promise<UserProfile[]> {
  const snap = await getDocs(collection(db, USERS));
  return snap.docs
    .map((d) => {
      const data = d.data();
      return {
        uid: d.id,
        email: data.email || '',
        name: data.name || 'User',
        role: data.role === 'admin' ? 'admin' : 'sales',
        active: Boolean(data.active),
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
      } as UserProfile;
    })
    .sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name));
}

/**
 * Creates a sign-in account + profile. Uses a temporary second Firebase app so the admin
 * creating the account stays signed in.
 */
export async function createStaffUser(input: {
  name: string;
  email: string;
  password: string;
  role: UserRole;
}): Promise<string> {
  const name = `staff-creator-${Date.now()}`;
  const secondary = initializeApp(firebaseConfig, name);
  try {
    const secondaryAuth = getAuth(secondary);
    const cred = await createUserWithEmailAndPassword(secondaryAuth, input.email.trim(), input.password);
    await setDoc(doc(db, USERS, cred.user.uid), {
      uid: cred.user.uid,
      email: input.email.trim().toLowerCase(),
      name: input.name.trim(),
      role: input.role,
      active: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await signOut(secondaryAuth);
    return cred.user.uid;
  } finally {
    if (getApps().some((a) => a.name === name)) await deleteApp(secondary);
  }
}

export async function updateStaffUser(
  uid: string,
  updates: Partial<Pick<UserProfile, 'name' | 'role' | 'active'>>
): Promise<void> {
  await updateDoc(doc(db, USERS, uid), { ...updates, updatedAt: serverTimestamp() });
}

export async function sendPasswordReset(email: string): Promise<void> {
  await sendPasswordResetEmail(auth, email.trim());
}

export function formatUserAdminError(err: unknown): string {
  const code = (err as { code?: string })?.code || '';
  switch (code) {
    case 'auth/email-already-in-use':
      return 'An account with this email already exists.';
    case 'auth/invalid-email':
      return 'That email address is not valid.';
    case 'auth/weak-password':
      return 'Password must be at least 6 characters.';
    case 'auth/operation-not-allowed':
      return 'Email/password sign-in is disabled in Firebase.';
    case 'permission-denied':
      return 'Only active admins can manage users.';
    default:
      return err instanceof Error ? err.message : 'Something went wrong.';
  }
}

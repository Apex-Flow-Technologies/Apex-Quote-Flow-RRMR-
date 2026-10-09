import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { CompanySettings } from '../types/settings';

const SETTINGS_COLLECTION = 'settings';
const COMPANY_SETTINGS_DOC = 'company';

export async function getCompanySettings(): Promise<CompanySettings | null> {
  const docRef = doc(db, SETTINGS_COLLECTION, COMPANY_SETTINGS_DOC);
  const snap = await getDoc(docRef);
  if (!snap.exists()) return null;
  return snap.data() as CompanySettings;
}

export async function setCompanySettings(settings: CompanySettings): Promise<void> {
  const docRef = doc(db, SETTINGS_COLLECTION, COMPANY_SETTINGS_DOC);
  await setDoc(docRef, {
    ...settings,
    updatedAt: serverTimestamp(),
  });
}

export async function updateCompanySettings(updates: Partial<CompanySettings>): Promise<void> {
  const docRef = doc(db, SETTINGS_COLLECTION, COMPANY_SETTINGS_DOC);
  await updateDoc(docRef, {
    ...updates,
    updatedAt: serverTimestamp(),
  });
}

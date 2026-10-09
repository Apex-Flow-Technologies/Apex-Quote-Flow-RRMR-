import {
  doc,
  getDoc,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { QuotationCounter } from '../types/counter';

const COUNTER_COLLECTION = 'counters';
const QUOTATION_COUNTER_DOC = 'quotation';

/**
 * Safely and idempotently initializes the quotation counter document (counters/quotation).
 * If the document already exists, it is untouched.
 * If it does not exist, it is initialized with:
 * { next: 1, prefix: "RR/QT", financialYear: "26-27" }
 * Restricted to admins by Firestore security rules.
 */
export async function ensureQuotationCounter(): Promise<{ initialized: boolean; counter: QuotationCounter }> {
  const counterRef = doc(db, COUNTER_COLLECTION, QUOTATION_COUNTER_DOC);

  let initialized = false;
  let counterData: QuotationCounter = {
    next: 1,
    prefix: 'RR/QT',
    financialYear: '26-27',
  };

  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(counterRef);

    if (!snap.exists()) {
      transaction.set(counterRef, {
        next: 1,
        prefix: 'RR/QT',
        financialYear: '26-27',
        updatedAt: serverTimestamp(),
      });
      initialized = true;
    } else {
      counterData = snap.data() as QuotationCounter;
      initialized = false;
    }
  });

  return { initialized, counter: counterData };
}

export async function getQuotationCounter(): Promise<QuotationCounter | null> {
  const counterRef = doc(db, COUNTER_COLLECTION, QUOTATION_COUNTER_DOC);
  const snap = await getDoc(counterRef);
  if (!snap.exists()) return null;
  return snap.data() as QuotationCounter;
}

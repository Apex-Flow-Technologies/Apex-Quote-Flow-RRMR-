import {
  collection,
  doc,
  getDocs,
  getDoc,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { ensureQuotationCounter } from './counterService';
import type { Quotation, CreateQuotationInput } from '../types/quotation';
import type { QuotationCounter } from '../types/counter';

const QUOTATIONS_COLLECTION = 'quotations';
const COUNTER_COLLECTION = 'counters';
const QUOTATION_COUNTER_DOC = 'quotation';

export interface SavedQuotationResult {
  id: string;
  quotationNumber: string;
}

/**
 * Retrieves all saved quotations from Firestore.
 * Sorts client-side by quotationNumber descending (or createdAt desc).
 */
export async function getQuotations(): Promise<Quotation[]> {
  const colRef = collection(db, QUOTATIONS_COLLECTION);
  const snap = await getDocs(colRef);
  const quotations = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Quotation);

  // Sort descending by quotation number or createdAt
  return quotations.sort((a, b) => {
    if (a.quotationNumber && b.quotationNumber) {
      return b.quotationNumber.localeCompare(a.quotationNumber);
    }
    return 0;
  });
}

/**
 * Retrieves a single quotation by its Firestore document ID.
 */
export async function getQuotationById(id: string): Promise<Quotation | null> {
  const docRef = doc(db, QUOTATIONS_COLLECTION, id);
  const snap = await getDoc(docRef);
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as Quotation;
}

/**
 * Recursively strips undefined fields from an object or array before writing to Firestore.
 * Preserves primitives, null, Date, FieldValues (like serverTimestamp), and nested arrays/objects.
 */
export function sanitizeForFirestore<T>(data: T): T {
  if (data === undefined) {
    return undefined as unknown as T;
  }
  if (Array.isArray(data)) {
    return data
      .filter((item) => item !== undefined)
      .map((item) => sanitizeForFirestore(item)) as unknown as T;
  }
  if (data !== null && typeof data === 'object') {
    const proto = Object.getPrototypeOf(data);
    if (proto === null || proto === Object.prototype) {
      const clean: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
        if (value !== undefined) {
          clean[key] = sanitizeForFirestore(value);
        }
      }
      return clean as T;
    }
  }
  return data;
}

/**
 * Creates and saves a new Quotation with atomic quotation number allocation.
 *
 * Implements a strict Firestore runTransaction:
 * 1. Reads counters/quotation before any writes.
 * 2. Formats consecutive sequential quotation number (e.g., RR/QT/26-27/0001).
 * 3. Writes quotation document into quotations/{autoId}.
 * 4. Increments counters/quotation.next by exactly 1 (enforced by Firestore rules).
 * 5. Commits atomically. If a race condition occurs, Firestore automatically retries
 *    the transaction, generating the next consecutive number without duplicates or gaps.
 */
export async function createQuotation(
  input: CreateQuotationInput
): Promise<SavedQuotationResult> {
  const counterRef = doc(db, COUNTER_COLLECTION, QUOTATION_COUNTER_DOC);
  const newQuotationDocRef = doc(collection(db, QUOTATIONS_COLLECTION));

  // Seed counter idempotently if not already created
  const counterSnapPre = await getDoc(counterRef);
  if (!counterSnapPre.exists()) {
    await ensureQuotationCounter();
  }

  let generatedNumber = '';

  await runTransaction(db, async (transaction) => {
    // 1. Transaction Read: Read quotation counter
    const counterSnap = await transaction.get(counterRef);

    if (!counterSnap.exists()) {
      throw new Error(
        'Quotation counter (counters/quotation) is not initialized. Please ensure the counter is seeded.'
      );
    }

    const counter = counterSnap.data() as QuotationCounter;
    const currentNext = typeof counter.next === 'number' ? counter.next : 1;
    const prefix = counter.prefix || 'RR/QT';
    const financialYear = counter.financialYear || '26-27';

    // 2. Format 4-digit sequential quotation number
    const paddedSequence = String(currentNext).padStart(4, '0');
    generatedNumber = `${prefix}/${financialYear}/${paddedSequence}`;

    // 3. Prepare quotation document
    const rawPayload = {
      ...input,
      id: newQuotationDocRef.id,
      quotationNumber: generatedNumber,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    const quotationPayload = sanitizeForFirestore(rawPayload);

    // 4. Transaction Write: Set quotation document
    transaction.set(newQuotationDocRef, quotationPayload);

    // 5. Transaction Write: Atomically increment counter next by exactly 1
    // Keep prefix and financialYear identical to satisfy firestore security rules
    transaction.update(counterRef, {
      next: currentNext + 1,
      prefix,
      financialYear,
      updatedAt: serverTimestamp(),
    });
  });

  return {
    id: newQuotationDocRef.id,
    quotationNumber: generatedNumber,
  };
}

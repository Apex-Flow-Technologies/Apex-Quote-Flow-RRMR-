import {
  collection,
  doc,
  getDocs,
  getDocsFromCache,
  getDoc,
  runTransaction,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { ensureQuotationCounter } from './counterService';
import { financialYearFor, counterDocIdFor } from '../engine/financialYear';
import type { Quotation, CreateQuotationInput, QuotationStatus } from '../types/quotation';
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
function sortQuotations(quotations: Quotation[]): Quotation[] {
  return quotations.sort((a, b) =>
    a.quotationNumber && b.quotationNumber ? b.quotationNumber.localeCompare(a.quotationNumber) : 0
  );
}

/** Quotations from the on-device cache (instant; may be slightly stale). Empty if nothing cached. */
export async function getQuotationsFromDevice(): Promise<Quotation[]> {
  try {
    const snap = await getDocsFromCache(collection(db, QUOTATIONS_COLLECTION));
    return sortQuotations(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Quotation));
  } catch {
    return [];
  }
}

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
  // Financial year comes from the quotation date (April → March); numbers restart each year.
  const financialYear = financialYearFor(input.quotationDate || new Date());
  const counterRef = doc(db, COUNTER_COLLECTION, counterDocIdFor(financialYear));
  const newQuotationDocRef = doc(collection(db, QUOTATIONS_COLLECTION));
  const isLegacyCounter = counterRef.id === QUOTATION_COUNTER_DOC;

  // Seed the original 26-27 counter idempotently if it was never created (admin bootstrap)
  if (isLegacyCounter) {
    const counterSnapPre = await getDoc(counterRef);
    if (!counterSnapPre.exists()) {
      await ensureQuotationCounter();
    }
  }

  let generatedNumber = '';

  await runTransaction(db, async (transaction) => {
    // 1. Transaction Read: this financial year's counter
    const counterSnap = await transaction.get(counterRef);

    let currentNext = 1;
    let prefix = 'RR/QT';
    if (counterSnap.exists()) {
      const counter = counterSnap.data() as QuotationCounter;
      currentNext = typeof counter.next === 'number' ? counter.next : 1;
      prefix = counter.prefix || 'RR/QT';
    } else if (isLegacyCounter) {
      throw new Error(
        'Quotation counter (counters/quotation) is not initialized. Please ensure the counter is seeded.'
      );
    }

    // 2. Format 4-digit sequential quotation number
    const paddedSequence = String(currentNext).padStart(4, '0');
    generatedNumber = `${prefix}/${financialYear}/${paddedSequence}`;

    // 3. Prepare quotation document
    const rawPayload = {
      ...input,
      id: newQuotationDocRef.id,
      quotationNumber: generatedNumber,
      status: input.status || 'draft',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    const quotationPayload = sanitizeForFirestore(rawPayload);

    // 4. Transaction Write: Set quotation document
    transaction.set(newQuotationDocRef, quotationPayload);

    // 5. Counter: first quote of a new financial year creates that year's counter at next = 2;
    //    otherwise increment by exactly 1 (both enforced by Firestore rules).
    if (counterSnap.exists()) {
      transaction.update(counterRef, {
        next: currentNext + 1,
        prefix,
        financialYear,
        updatedAt: serverTimestamp(),
      });
    } else {
      transaction.set(counterRef, {
        next: 2,
        prefix,
        financialYear,
        updatedAt: serverTimestamp(),
      });
    }
  });

  return {
    id: newQuotationDocRef.id,
    quotationNumber: generatedNumber,
  };
}

/**
 * Changes a quotation's status (Draft / Sent / Won / Lost / Cancelled).
 * Firestore rules let any active sales/admin user change ONLY these fields.
 */
export async function updateQuotationStatus(
  id: string,
  status: QuotationStatus,
  byName: string
): Promise<void> {
  await updateDoc(doc(db, QUOTATIONS_COLLECTION, id), {
    status,
    statusUpdatedBy: byName,
    statusUpdatedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

/**
 * Saves a revision of an existing quotation: same quotation number, revision + 1,
 * lines / totals / customer replaced. Allowed for admins and for the quotation's creator.
 */
export async function reviseQuotation(
  existing: Quotation,
  input: CreateQuotationInput,
  byName: string
): Promise<SavedQuotationResult> {
  const ref = doc(db, QUOTATIONS_COLLECTION, existing.id);
  const payload = sanitizeForFirestore({
    ...input,
    id: existing.id,
    quotationNumber: existing.quotationNumber,
    revision: (existing.revision || 1) + 1,
    status: existing.status || 'draft',
    createdByUid: existing.createdByUid,
    createdByName: existing.createdByName,
    revisedByName: byName,
    revisedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  await updateDoc(ref, payload as Record<string, unknown>);
  return { id: existing.id, quotationNumber: existing.quotationNumber };
}

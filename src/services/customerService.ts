import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { Customer, CreateCustomerInput } from '../types/customer';

const CUSTOMERS_COLLECTION = 'customers';

export async function getCustomers(): Promise<Customer[]> {
  const colRef = collection(db, CUSTOMERS_COLLECTION);
  const snap = await getDocs(colRef);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Customer);
}

export async function getCustomerById(id: string): Promise<Customer | null> {
  const docRef = doc(db, CUSTOMERS_COLLECTION, id);
  const snap = await getDoc(docRef);
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as Customer;
}

export async function createCustomer(customer: CreateCustomerInput): Promise<string> {
  const id = customer.id || doc(collection(db, CUSTOMERS_COLLECTION)).id;
  const docRef = doc(db, CUSTOMERS_COLLECTION, id);
  await setDoc(docRef, {
    ...customer,
    id,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return id;
}

export async function updateCustomer(id: string, updates: Partial<Customer>): Promise<void> {
  const docRef = doc(db, CUSTOMERS_COLLECTION, id);
  await updateDoc(docRef, {
    ...updates,
    updatedAt: serverTimestamp(),
  });
}

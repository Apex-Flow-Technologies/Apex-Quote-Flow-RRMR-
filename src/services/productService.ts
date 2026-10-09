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
import type { Product, CreateProductInput } from '../types/product';

const PRODUCTS_COLLECTION = 'products';

export async function getProducts(): Promise<Product[]> {
  const colRef = collection(db, PRODUCTS_COLLECTION);
  const snap = await getDocs(colRef);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Product);
}

export async function getProductById(id: string): Promise<Product | null> {
  const docRef = doc(db, PRODUCTS_COLLECTION, id);
  const snap = await getDoc(docRef);
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as Product;
}

export async function createProduct(product: CreateProductInput): Promise<string> {
  const id = product.id || doc(collection(db, PRODUCTS_COLLECTION)).id;
  const docRef = doc(db, PRODUCTS_COLLECTION, id);
  await setDoc(docRef, {
    ...product,
    id,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return id;
}

export async function updateProduct(id: string, updates: Partial<Product>): Promise<void> {
  const docRef = doc(db, PRODUCTS_COLLECTION, id);
  await updateDoc(docRef, {
    ...updates,
    updatedAt: serverTimestamp(),
  });
}

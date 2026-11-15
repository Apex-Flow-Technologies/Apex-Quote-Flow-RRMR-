/**
 * Stale-while-revalidate cache for master data (products, customers, company settings).
 *
 * Why: the quotation builder used to wait for three full server reads (incl. ~370 products)
 * every time it opened — slow on phones. Now:
 *   1. memory cache (same session)          → instant
 *   2. Firestore's on-device cache (IndexedDB) → instant on later visits
 *   3. server                                → refreshed in the background, result kept for next time
 * Callers can pass `onFresh` to receive the server copy when it arrives.
 */
import { collection, doc, getDocs, getDocsFromCache, getDoc, getDocFromCache } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { Product } from '../types/product';
import type { Customer } from '../types/customer';
import type { CompanySettings } from '../types/settings';

interface Entry<T> {
  data: T;
  fresh: boolean; // true once confirmed by the server this session
}

const mem: { products?: Entry<Product[]>; customers?: Entry<Customer[]>; company?: Entry<CompanySettings | null> } = {};
const inflight: Partial<Record<keyof typeof mem, Promise<unknown>>> = {};

async function readCollection<T>(name: string, fromCache: boolean): Promise<T[]> {
  const ref = collection(db, name);
  const snap = fromCache ? await getDocsFromCache(ref) : await getDocs(ref);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as T);
}

function cached<K extends keyof typeof mem>(
  key: K,
  fromServer: () => Promise<NonNullable<(typeof mem)[K]>['data']>,
  fromDevice: () => Promise<NonNullable<(typeof mem)[K]>['data'] | null>,
  onFresh?: (data: NonNullable<(typeof mem)[K]>['data']) => void
): Promise<NonNullable<(typeof mem)[K]>['data']> {
  type D = NonNullable<(typeof mem)[K]>['data'];

  const refresh = (): Promise<D> => {
    if (!inflight[key]) {
      inflight[key] = fromServer()
        .then((data) => {
          (mem as Record<string, Entry<D>>)[key] = { data, fresh: true };
          return data;
        })
        .finally(() => {
          delete inflight[key];
        });
    }
    return inflight[key] as Promise<D>;
  };

  const hit = mem[key] as Entry<D> | undefined;
  if (hit) {
    if (!hit.fresh) refresh().then((d) => onFresh?.(d)).catch(() => {});
    return Promise.resolve(hit.data);
  }

  return fromDevice()
    .catch(() => null)
    .then((local) => {
      const hasLocal = Array.isArray(local) ? local.length > 0 : local !== null && local !== undefined;
      if (hasLocal) {
        (mem as Record<string, Entry<D>>)[key] = { data: local as D, fresh: false };
        refresh().then((d) => onFresh?.(d)).catch(() => {});
        return local as D;
      }
      return refresh();
    });
}

export function getProductsCached(onFresh?: (p: Product[]) => void): Promise<Product[]> {
  return cached(
    'products',
    () => readCollection<Product>('products', false),
    () => readCollection<Product>('products', true),
    onFresh
  );
}

export function getCustomersCached(onFresh?: (c: Customer[]) => void): Promise<Customer[]> {
  return cached(
    'customers',
    () => readCollection<Customer>('customers', false),
    () => readCollection<Customer>('customers', true),
    onFresh
  );
}

export function getCompanySettingsCached(
  onFresh?: (c: CompanySettings | null) => void
): Promise<CompanySettings | null> {
  const ref = () => doc(db, 'settings', 'company');
  return cached(
    'company',
    async () => {
      const s = await getDoc(ref());
      return s.exists() ? (s.data() as CompanySettings) : null;
    },
    async () => {
      const s = await getDocFromCache(ref());
      return s.exists() ? (s.data() as CompanySettings) : null;
    },
    onFresh
  );
}

/** Call after creating / editing master data so the next read goes to the server. */
export function invalidateMasterData(key?: keyof typeof mem): void {
  if (key) delete mem[key];
  else {
    delete mem.products;
    delete mem.customers;
    delete mem.company;
  }
}

/** Warm the caches right after login so "New Quotation" opens instantly. */
export function prefetchMasterData(): void {
  getProductsCached().catch(() => {});
  getCustomersCached().catch(() => {});
  getCompanySettingsCached().catch(() => {});
}

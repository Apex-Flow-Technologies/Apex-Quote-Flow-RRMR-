/**
 * Firestore security-rules tests. Run with:  npm run test:rules
 * (starts the Firestore emulator, runs these, shuts it down).
 */
import { readFileSync } from 'node:fs';
import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, setDoc, updateDoc, getDoc, deleteDoc, runTransaction } from 'firebase/firestore';

let env: RulesTestEnvironment;

const users = {
  admin: { role: 'admin', active: true, name: 'Admin' },
  sales: { role: 'sales', active: true, name: 'Sales' },
  sales2: { role: 'sales', active: true, name: 'Sales 2' },
  inactive: { role: 'sales', active: false, name: 'Old' },
};

const quote = (uid: string, extra: Record<string, unknown> = {}) => ({
  quotationNumber: 'RR/QT/26-27/0018',
  revision: 1,
  status: 'draft',
  createdByUid: uid,
  createdByName: uid,
  lines: [],
  payableAmount: 100,
  ...extra,
});

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-rr-rules',
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
  });
});
afterAll(async () => env?.cleanup());

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    for (const [uid, data] of Object.entries(users)) await setDoc(doc(db, 'users', uid), data);
    await setDoc(doc(db, 'counters', 'quotation'), { next: 18, prefix: 'RR/QT', financialYear: '26-27' });
    await setDoc(doc(db, 'quotations', 'q1'), quote('sales'));
  });
});

const as = (uid: keyof typeof users) => env.authenticatedContext(uid).firestore();

describe('quotations', () => {
  it('sales can create a quotation as themselves, not as someone else', async () => {
    await assertSucceeds(setDoc(doc(as('sales'), 'quotations', 'new1'), quote('sales')));
    await assertFails(setDoc(doc(as('sales'), 'quotations', 'new2'), quote('admin')));
  });

  it('inactive users cannot read or create', async () => {
    await assertFails(getDoc(doc(as('inactive'), 'quotations', 'q1')));
    await assertFails(setDoc(doc(as('inactive'), 'quotations', 'new3'), quote('inactive')));
  });

  it('any sales user can change status only', async () => {
    await assertSucceeds(updateDoc(doc(as('sales2'), 'quotations', 'q1'), { status: 'sent', statusUpdatedBy: 'Sales 2' }));
    await assertFails(updateDoc(doc(as('sales2'), 'quotations', 'q1'), { status: 'won', payableAmount: 1 }));
  });

  it('creator can revise (revision + 1, same number); others cannot', async () => {
    await assertSucceeds(updateDoc(doc(as('sales'), 'quotations', 'q1'), { revision: 2, payableAmount: 200 }));
    await assertFails(updateDoc(doc(as('sales2'), 'quotations', 'q1'), { revision: 3, payableAmount: 300 }));
  });

  it('revise cannot change number or skip revisions', async () => {
    await assertFails(updateDoc(doc(as('sales'), 'quotations', 'q1'), { revision: 2, quotationNumber: 'X' }));
    await assertFails(updateDoc(doc(as('sales'), 'quotations', 'q1'), { revision: 5, payableAmount: 1 }));
  });

  it('admin can edit and delete; sales cannot delete', async () => {
    await assertSucceeds(updateDoc(doc(as('admin'), 'quotations', 'q1'), { payableAmount: 5 }));
    await assertFails(deleteDoc(doc(as('sales'), 'quotations', 'q1')));
    await assertSucceeds(deleteDoc(doc(as('admin'), 'quotations', 'q1')));
  });
});

describe('quotation counters', () => {
  it('26-27 counter increments by exactly 1', async () => {
    const db = as('sales');
    await assertSucceeds(updateDoc(doc(db, 'counters', 'quotation'), { next: 19, prefix: 'RR/QT', financialYear: '26-27' }));
    await assertFails(updateDoc(doc(db, 'counters', 'quotation'), { next: 25 }));
    await assertFails(updateDoc(doc(db, 'counters', 'quotation'), { next: 20, financialYear: '27-28' }));
  });

  it('first quote of a new year creates its counter at next = 2', async () => {
    const db = as('sales');
    await assertSucceeds(setDoc(doc(db, 'counters', 'quotation-27-28'), { next: 2, prefix: 'RR/QT', financialYear: '27-28' }));
    await assertSucceeds(updateDoc(doc(db, 'counters', 'quotation-27-28'), { next: 3 }));
  });

  it('new-year counter must match its id, start at 2, and use RR/QT', async () => {
    const db = as('sales');
    await assertFails(setDoc(doc(db, 'counters', 'quotation-27-28'), { next: 2, prefix: 'RR/QT', financialYear: '28-29' }));
    await assertFails(setDoc(doc(db, 'counters', 'quotation-27-28'), { next: 50, prefix: 'RR/QT', financialYear: '27-28' }));
    await assertFails(setDoc(doc(db, 'counters', 'quotation-27-28'), { next: 2, prefix: 'HACK', financialYear: '27-28' }));
    await assertFails(setDoc(doc(db, 'counters', 'other'), { next: 2, prefix: 'RR/QT', financialYear: '27-28' }));
  });

  it('a full new-year quote transaction succeeds for sales', async () => {
    const db = as('sales');
    await assertSucceeds(
      runTransaction(db, async (t) => {
        const c = doc(db, 'counters', 'quotation-27-28');
        await t.get(c);
        t.set(doc(db, 'quotations', 'fy2'), quote('sales', { quotationNumber: 'RR/QT/27-28/0001' }));
        t.set(c, { next: 2, prefix: 'RR/QT', financialYear: '27-28' });
      })
    );
  });
});

describe('products & users', () => {
  it('only admins write products; sales can read', async () => {
    await assertSucceeds(setDoc(doc(as('admin'), 'products', 'p1'), { name: 'x' }));
    await assertFails(setDoc(doc(as('sales'), 'products', 'p2'), { name: 'x' }));
    await assertSucceeds(getDoc(doc(as('sales'), 'products', 'p1')));
  });

  it('only admins manage users', async () => {
    await assertSucceeds(updateDoc(doc(as('admin'), 'users', 'sales2'), { active: false }));
    await assertFails(updateDoc(doc(as('sales'), 'users', 'sales'), { role: 'admin' }));
  });
});

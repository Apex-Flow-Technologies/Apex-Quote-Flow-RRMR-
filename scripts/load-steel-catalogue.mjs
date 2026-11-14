// Loads the structural steel catalogue (src/data/steelCatalogue.ts) into Firestore `products`.
// Only creates products whose id does not exist yet — never overwrites RR's edits (rates etc).
//
// Usage:  FIRESTORE_TOKEN=<oauth access token> node scripts/load-steel-catalogue.mjs [--write]
//         (without --write it is a dry run)
import { createJiti } from 'jiti';

const PROJECT = 'rr-metal-roofing';
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;
const write = process.argv.includes('--write');
const token = process.env.FIRESTORE_TOKEN;
if (!token) throw new Error('FIRESTORE_TOKEN not set');

const jiti = createJiti(import.meta.url);
const { buildSteelCatalogue } = await jiti.import('../src/data/steelCatalogue.ts');
const catalogue = buildSteelCatalogue();

const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

function encode(v) {
  if (v === null) return { nullValue: null };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === 'string') return { stringValue: v };
  if (typeof v === 'object') {
    const fields = {};
    for (const [k, val] of Object.entries(v)) if (val !== undefined) fields[k] = encode(val);
    return { mapValue: { fields } };
  }
  throw new Error(`cannot encode ${typeof v}`);
}

// Existing product ids
const existing = new Set();
let pageToken = '';
do {
  const url = `${BASE}/products?pageSize=300&mask.fieldPaths=name${pageToken ? `&pageToken=${pageToken}` : ''}`;
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`list failed ${res.status}: ${await res.text()}`);
  const body = await res.json();
  for (const d of body.documents || []) existing.add(d.name.split('/').pop());
  pageToken = body.nextPageToken || '';
} while (pageToken);

const toCreate = catalogue.filter((i) => !existing.has(i.id));
console.log(`products in Firestore: ${existing.size}`);
console.log(`catalogue items: ${catalogue.length}, already present: ${catalogue.length - toCreate.length}, to create: ${toCreate.length}`);
const byCat = {};
for (const i of toCreate) byCat[i.category] = (byCat[i.category] || 0) + 1;
console.log('by category:', byCat);
console.log('sample:', toCreate.slice(0, 3).map((i) => `${i.name} → ${i.kgPerMetre} kg/m`));

if (!write) {
  console.log('dry run — pass --write to create');
  process.exit(0);
}

for (let i = 0; i < toCreate.length; i += 200) {
  const chunk = toCreate.slice(i, i + 200);
  const writes = chunk.map((item) => ({
    update: {
      name: `projects/${PROJECT}/databases/(default)/documents/products/${item.id}`,
      fields: encode(item).mapValue.fields,
    },
    currentDocument: { exists: false },
    updateTransforms: [
      { fieldPath: 'createdAt', setToServerValue: 'REQUEST_TIME' },
      { fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' },
    ],
  }));
  const res = await fetch(`${BASE}:commit`, { method: 'POST', headers, body: JSON.stringify({ writes }) });
  if (!res.ok) throw new Error(`commit failed ${res.status}: ${await res.text()}`);
  console.log(`created ${i + chunk.length}/${toCreate.length}`);
}
console.log('done');

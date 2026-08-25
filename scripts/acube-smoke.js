/**
 * Smoke test ACube — corrispettivi telematici (sandbox).
 *
 * Esegue end-to-end:
 *   1. Login → JWT
 *   2. Setup Business Registry Configuration (idempotente)
 *   3. Emette 2 scontrini di prova
 *   4. Polling stato fino a `ready`
 *   5. Scarica PDF del primo scontrino
 *   6. Report CSV della giornata
 *
 * Uso: node scripts/acube-smoke.js
 */

import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';

const AUTH_URL = 'https://common-sandbox.api.acubeapi.com';
const API_URL = 'https://api-sandbox.acubeapi.com';

const { ACUBE_EMAIL, ACUBE_PASSWORD } = process.env;
let fiscalId = process.env.ACUBE_TEST_FISCAL_ID;

if (!ACUBE_EMAIL || !ACUBE_PASSWORD || !fiscalId) {
  console.error('❌ Mancano variabili ACUBE_EMAIL / ACUBE_PASSWORD / ACUBE_TEST_FISCAL_ID nel .env');
  process.exit(1);
}

let token;

// Genera una Partita IVA italiana di 11 cifre con check digit valido (algoritmo Luhn-like).
function generateValidPiva() {
  const digits = Array.from({ length: 10 }, () => Math.floor(Math.random() * 10));
  let sum = 0;
  for (let i = 0; i < 10; i++) {
    if (i % 2 === 0) sum += digits[i];
    else {
      const x = digits[i] * 2;
      sum += x > 9 ? x - 9 : x;
    }
  }
  const check = (10 - (sum % 10)) % 10;
  return digits.join('') + check;
}

async function login() {
  const res = await fetch(`${AUTH_URL}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ACUBE_EMAIL, password: ACUBE_PASSWORD }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Login ${res.status}: ${text}`);
  const data = JSON.parse(text);
  token = data.token;
}

async function api(method, urlPath, { body, accept = 'application/json' } = {}) {
  const res = await fetch(`${API_URL}${urlPath}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: accept,
      ...(body && { 'Content-Type': 'application/json' }),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return res;
}

async function tryCreateBRC(fid) {
  return api('POST', '/business-registry-configurations', {
    body: {
      fiscal_id: fid,
      name: 'Coltivare Demo Sandbox',
      email: 'demo@youbidata.com',
      receipts_enabled: true,
    },
  });
}

async function ensureBRC() {
  // 1. Prova GET diretto (BRC già nostro?)
  let res = await api('GET', `/business-registry-configurations/${fiscalId}`);
  if (res.ok) return await res.json();

  // 2. POST con il fiscal_id richiesto
  res = await tryCreateBRC(fiscalId);
  if (res.ok) return await res.json();

  const text = await res.text();
  if (res.status !== 400 || !text.includes('already used')) {
    throw new Error(`POST BRC ${res.status}: ${text}`);
  }

  // 3. Fallback: il fiscal_id è preso da altri tenant sandbox → ne genero uno nuovo
  console.log(`   ⚠️  fiscal_id ${fiscalId} già preso in sandbox, genero un sostituto…`);
  for (let i = 0; i < 5; i++) {
    const candidate = generateValidPiva();
    const r = await tryCreateBRC(candidate);
    if (r.ok) {
      fiscalId = candidate;
      console.log(`   ℹ️  nuovo fiscal_id usato: ${candidate}`);
      console.log(`   ℹ️  aggiorna .env: ACUBE_TEST_FISCAL_ID=${candidate}`);
      return await r.json();
    }
  }
  throw new Error('Impossibile generare un fiscal_id libero dopo 5 tentativi');
}

async function createReceipt(item) {
  const res = await api('POST', '/receipts', {
    body: {
      fiscal_id: fiscalId,
      items: [item],
      cash_payment_amount: item.unit_price,
    },
  });
  if (!res.ok) throw new Error(`POST /receipts ${res.status}: ${await res.text()}`);
  return await res.json();
}

async function pollReceipt(uuid, maxMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    const res = await api('GET', `/receipts/${uuid}`);
    if (res.ok) {
      const data = await res.json();
      if (['ready', 'failed', 'voided'].includes(data.status)) return data;
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error(`Timeout polling ${uuid}`);
}

async function downloadPdf(uuid) {
  const res = await api('GET', `/receipts/${uuid}/details`, { accept: 'application/pdf' });
  if (!res.ok) throw new Error(`PDF ${res.status}: ${await res.text()}`);
  return Buffer.from(await res.arrayBuffer());
}

async function dailyReport() {
  const today = new Date().toISOString().slice(0, 10);
  const res = await api('GET', `/receipts/report?created_at[after]=${today}`, { accept: 'text/csv' });
  if (!res.ok) throw new Error(`Report ${res.status}: ${await res.text()}`);
  return await res.text();
}

async function main() {
  console.log('🔐 Login…');
  await login();
  console.log('   ✅ JWT ottenuto');

  console.log('\n🏢 Setup Business Registry Configuration…');
  const brc = await ensureBRC();
  console.log(`   ✅ BRC ${brc.fiscal_id} — receipts_enabled=${brc.receipts_enabled}`);

  console.log('\n🧾 Emissione 2 scontrini di prova…');
  const items = [
    { quantity: '1.00', description: 'Caffè YouBiData 250g', unit_price: '12.90', vat_rate_code: '22' },
    { quantity: '1.00', description: 'Tazza espresso', unit_price: '18.90', vat_rate_code: '22' },
  ];
  const receipts = [];
  for (const item of items) {
    const r = await createReceipt(item);
    console.log(`   → uuid=${r.uuid} status=${r.status}`);
    receipts.push(r);
  }

  console.log('\n⏳ Polling stato fino a "ready"…');
  for (const r of receipts) {
    const final = await pollReceipt(r.uuid);
    console.log(`   ${final.uuid} → ${final.status} tx=${final.transaction_id || '—'} doc=${final.document_number || '—'}`);
  }

  console.log('\n📄 Download PDF primo scontrino…');
  await fs.mkdir('tmp', { recursive: true });
  const pdfBuf = await downloadPdf(receipts[0].uuid);
  const pdfPath = path.join('tmp', `receipt-${receipts[0].uuid}.pdf`);
  await fs.writeFile(pdfPath, pdfBuf);
  console.log(`   ✅ ${pdfPath} (${pdfBuf.length} bytes)`);

  console.log('\n📊 Report giornaliera CSV…');
  const csv = await dailyReport();
  const csvPath = path.join('tmp', `daily-report-${new Date().toISOString().slice(0, 10)}.csv`);
  await fs.writeFile(csvPath, csv);
  console.log(`   ✅ ${csvPath} (${csv.split('\n').length - 1} righe)`);

  console.log('\n🎉 Smoke completato.');
}

main().catch((e) => {
  console.error('\n❌', e.message);
  process.exit(1);
});

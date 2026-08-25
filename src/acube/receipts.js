import { acube } from './client.js';
import { getProduct } from '../catalog.js';
import { attachFiscalReceipt } from '../orders.js';

const { ACUBE_TEST_FISCAL_ID } = process.env;

// Mappa gli item dell'ordine (formato { id, qty }) sul formato ReceiptItem di ACube.
// I prezzi del catalogo sono già lordi (IVA inclusa), come richiede unit_price.
function buildItems(order) {
  return order.items.map(({ id, qty }) => {
    const p = getProduct(id);
    if (!p) throw new Error(`Prodotto non trovato a catalogo: ${id}`);
    return {
      quantity: qty.toFixed(2),
      description: p.name,
      unit_price: (p.priceCents / 100).toFixed(2),
      vat_rate_code: '22',
    };
  });
}

async function pollUntilReady(uuid, maxMs = 30_000) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    const r = await acube.getReceipt(uuid);
    if (['ready', 'failed', 'voided'].includes(r.status)) return r;
    await new Promise((res) => setTimeout(res, 2000));
  }
  // Timeout: ritorna l'ultimo stato noto senza bloccare la chiusura.
  return acube.getReceipt(uuid);
}

// Emette uno scontrino telematico per un ordine pagato e lo trascrive sull'ordine.
// Ritorna { ok, receipt } oppure { ok:false, error }.
export async function emitReceipt(order) {
  if (order.fiscalReceipt) {
    return { ok: true, receipt: order.fiscalReceipt, alreadyEmitted: true };
  }

  const payload = {
    fiscal_id: ACUBE_TEST_FISCAL_ID,
    items: buildItems(order),
    // L'ordine è stato saldato online (Stripe/PayPal) → pagamento elettronico.
    electronic_payment_amount: (order.totalCents / 100).toFixed(2),
  };

  const created = await acube.createReceipt(payload);
  const final = await pollUntilReady(created.uuid);

  attachFiscalReceipt(order.id, {
    uuid: final.uuid,
    status: final.status,
    transactionId: final.transaction_id || null,
    documentNumber: final.document_number || null,
    documentDate: final.document_date || null,
  });

  console.log(`🧾 ACube — scontrino ordine ${order.id}: ${final.status} (tx ${final.transaction_id || '—'})`);
  return { ok: final.status === 'ready', receipt: final };
}

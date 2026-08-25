import express from 'express';
import { acube } from './client.js';
import { emitReceipt } from './receipts.js';
import { listOrders } from '../orders.js';

const router = express.Router();
const { ACUBE_TEST_FISCAL_ID } = process.env;

// Un ordine va trasmesso se è stato pagato (qualunque stato logistico successivo)
// e non ha ancora uno scontrino fiscale associato.
function isPending(order) {
  const paid = order.paidAt || ['paid', 'shipped', 'delivered'].includes(order.status);
  return paid && !order.fiscalReceipt;
}

// Idempotente: crea il soggetto emittente solo se non esiste già.
async function ensureBusinessRegistry() {
  const existing = await acube.getBusinessRegistry(ACUBE_TEST_FISCAL_ID);
  if (existing) return existing;
  return acube.createBusinessRegistry(ACUBE_TEST_FISCAL_ID);
}

// Anteprima per la UI: quanti ordini sono in attesa di trasmissione.
router.get('/pending', (_req, res) => {
  const pending = listOrders().filter(isPending);
  const totalCents = pending.reduce((sum, o) => sum + o.totalCents, 0);
  res.json({
    ok: true,
    count: pending.length,
    totalCents,
    orders: pending.map((o) => ({ id: o.id, totalCents: o.totalCents })),
  });
});

// Il "pulsantone": consolida e trasmette all'Agenzia delle Entrate tutti gli
// ordini pagati non ancora trasmessi.
router.post('/daily-closure', async (_req, res) => {
  if (!ACUBE_TEST_FISCAL_ID) {
    return res.status(500).json({ ok: false, error: 'ACUBE_TEST_FISCAL_ID non configurato' });
  }

  const pending = listOrders().filter(isPending);
  if (pending.length === 0) {
    return res.json({ ok: true, emitted: [], errors: [], message: 'Nessun ordine da trasmettere' });
  }

  try {
    await ensureBusinessRegistry();
  } catch (err) {
    return res.status(500).json({ ok: false, error: `Setup soggetto emittente fallito: ${err.message}` });
  }

  const emitted = [];
  const errors = [];
  for (const order of pending) {
    try {
      const { receipt } = await emitReceipt(order);
      emitted.push({
        orderId: order.id,
        uuid: receipt.uuid,
        status: receipt.status,
        documentNumber: receipt.document_number || receipt.documentNumber || null,
        transactionId: receipt.transaction_id || receipt.transactionId || null,
      });
    } catch (err) {
      console.error(`❌ ACube — emissione ordine ${order.id} fallita:`, err.message);
      errors.push({ orderId: order.id, error: err.message });
    }
  }

  console.log(`🧾 ACube — chiusura giornaliera: ${emitted.length} trasmessi, ${errors.length} errori`);
  res.json({ ok: true, emitted, errors });
});

// Scarica il report CSV degli scontrini emessi oggi (proxy verso ACube).
router.get('/report', async (_req, res) => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const csv = await acube.getReport(today);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="chiusura-${today}.csv"`);
    res.send(csv);
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;

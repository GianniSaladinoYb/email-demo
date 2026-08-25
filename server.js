import 'dotenv/config';
import express from 'express';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import stripeCheckoutRouter from './src/stripe/checkout.js';
import stripeWebhookRouter from './src/stripe/webhook.js';
import paypalOrdersRouter from './src/paypal/orders.js';
import qaplaShipmentsRouter from './src/qapla/shipments.js';
import acubeClosureRouter from './src/acube/closure.js';
import { sendEmail } from './src/email/client.js';
import { CATALOG } from './src/catalog.js';
import { getOrder, listOrders } from './src/orders.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const { RESEND_API_KEY, MAIL_FROM, MAIL_TO, MAIL_SUBJECT, PORT = 3000 } = process.env;

if (!RESEND_API_KEY || RESEND_API_KEY.startsWith('re_xxxx')) {
  console.error('\n❌ RESEND_API_KEY non configurata. Modifica il file .env con la tua API key reale.');
  console.error('   Ottienila qui: https://resend.com/api-keys\n');
  process.exit(1);
}

if (!MAIL_TO || !MAIL_SUBJECT) {
  console.error('\n❌ MAIL_TO o MAIL_SUBJECT non configurati nel file .env\n');
  process.exit(1);
}

const MAIL_BODY = `Ciao,

questa è un'email di test inviata dalla demo locale di YoubiData.

Se la ricevi, il setup funziona correttamente.

Grazie!`;

const app = express();

// CRITICO: il webhook Stripe richiede raw body per la signature verify.
// Va montato PRIMA di express.json() globale, altrimenti la verifica fallisce.
app.use('/webhooks/stripe', express.raw({ type: 'application/json' }), stripeWebhookRouter);

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// API pagamenti
app.use('/api/stripe', stripeCheckoutRouter);
app.use('/api/paypal', paypalOrdersRouter);
app.use('/api/qapla', qaplaShipmentsRouter);
app.use('/api/acube', acubeClosureRouter);

app.get('/api/catalog', (_req, res) => res.json(CATALOG));
app.get('/api/orders/:id', (req, res) => {
  const order = getOrder(req.params.id);
  if (!order) return res.status(404).json({ ok: false, error: 'Ordine non trovato' });
  res.json(order);
});

// Endpoint admin: in produzione richiederebbe auth (sessione + ruolo "operator").
// Per la demo è esposto liberamente — il banner sulla pagina /admin.html lo segnala.
app.get('/api/admin/orders', (_req, res) => {
  res.json({ ok: true, orders: listOrders() });
});

app.get('/api/paypal-config', (_req, res) => {
  res.json({ clientId: process.env.PAYPAL_CLIENT_ID || '', env: process.env.PAYPAL_ENV || 'sandbox' });
});

app.post('/send', async (_req, res) => {
  const result = await sendEmail({
    subject: MAIL_SUBJECT,
    html: `
      <div style="font-family: -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
        <h2 style="color: #1a1a1a;">${escapeHtml(MAIL_SUBJECT)}</h2>
        <div style="color: #444; line-height: 1.6; white-space: pre-wrap;">${escapeHtml(MAIL_BODY)}</div>
        <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;">
        <p style="color: #999; font-size: 12px;">
          Email inviata da YouBiData via demo Resend · ${new Date().toLocaleString('it-IT')}
        </p>
      </div>
    `,
  });
  if (result.ok) return res.json({ ok: true, id: result.id });
  return res.status(500).json({ ok: false, error: result.error?.message || 'Errore invio' });
});

app.get('/config', (_req, res) => {
  res.json({ to: MAIL_TO, subject: MAIL_SUBJECT });
});

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

app.listen(PORT, () => {
  console.log(`\n🚀 Server in ascolto su http://localhost:${PORT}\n`);
  console.log(`   📧 Email demo:`);
  console.log(`      Mittente:     ${MAIL_FROM}`);
  console.log(`      Destinatario: ${MAIL_TO}`);
  console.log(`      Pagina:       http://localhost:${PORT}/\n`);
  console.log(`   💳 Pagamenti demo:`);
  console.log(`      Stripe key:   ${process.env.STRIPE_SECRET_KEY?.startsWith('sk_test_xxxx') ? '❌ non configurata' : '✅'}`);
  console.log(`      PayPal:       ${process.env.PAYPAL_CLIENT_ID?.startsWith('xxxx') ? '❌ non configurata' : '✅'} (${process.env.PAYPAL_ENV || 'sandbox'})`);
  console.log(`      Pagina:       http://localhost:${PORT}/cart.html\n`);
  console.log(`   📦 Tracking spedizioni demo:`);
  console.log(`      Qapla' key:   ${!process.env.QAPLA_API_KEY || process.env.QAPLA_API_KEY.length < 20 ? '❌ non configurata' : '✅'}`);
  console.log(`      Integrato sulla success page dopo un pagamento riuscito.\n`);
  console.log(`   🧾 Corrispettivi telematici demo (ACube):`);
  console.log(`      ACube:        ${!process.env.ACUBE_EMAIL || !process.env.ACUBE_PASSWORD ? '❌ non configurata' : '✅'} (${process.env.ACUBE_ENV || 'sandbox'})`);
  console.log(`      Chiusura giornaliera dal back-office: http://localhost:${PORT}/admin.html\n`);
  console.log(`   ℹ️  Per testare i webhook Stripe in locale:`);
  console.log(`      stripe listen --forward-to localhost:${PORT}/webhooks/stripe\n`);
});

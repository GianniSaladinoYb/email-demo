import { sendEmail } from './client.js';

const eur = (cents) => (cents / 100).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });
const dt = (iso) => new Date(iso).toLocaleString('it-IT');

// Box "demo notice" inserito in fondo a ogni email per chiarire al lettore
// che si tratta di test mode e che in prod il destinatario sarebbe il cliente vero.
function demoNotice(order) {
  if (!order.customer?.email) return '';
  return `
    <div style="margin-top:24px;padding:12px 14px;background:#fff8e1;border-radius:6px;color:#6a5419;font-size:12px;line-height:1.6;">
      <strong>Modalità test Resend</strong>: in produzione questa email arriverebbe a
      <code>${order.customer.email}</code> (l'indirizzo del cliente sull'ordine). Per i limiti del
      sender <code>onboarding@resend.dev</code>, in demo viene mandata sempre all'account registrato.
    </div>
  `;
}

function shell({ title, body, accent = '#0071e3' }) {
  return `
    <div style="font-family:-apple-system,'Segoe UI',sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#1d1d1f;">
      <div style="border-top:4px solid ${accent};padding-top:18px;">
        <h2 style="margin:0 0 8px;font-size:20px;">${title}</h2>
      </div>
      ${body}
      <hr style="border:none;border-top:1px solid #eee;margin:24px 0 12px;">
      <p style="color:#999;font-size:11px;margin:0;">YouBiData · demo locale ${dt(new Date().toISOString())}</p>
    </div>
  `;
}

function itemsTable(order) {
  return `
    <table style="width:100%;border-collapse:collapse;margin-top:12px;font-size:14px;">
      ${order.items.map((i) => `
        <tr>
          <td style="padding:6px 0;border-bottom:1px solid #f0f0f3;">${i.qty} × <strong>${i.id}</strong></td>
        </tr>
      `).join('')}
      <tr>
        <td style="padding:10px 0 0;font-weight:600;text-align:right;">Totale ${eur(order.totalCents)}</td>
      </tr>
    </table>
  `;
}

function addressBlock(order) {
  const a = order.shippingAddress;
  if (!a) return '';
  return `
    <div style="margin-top:18px;padding:12px 14px;background:#f5f5f7;border-radius:6px;font-size:13px;line-height:1.7;">
      <strong>Spedito a:</strong><br>
      ${a.name || ''}<br>
      ${a.line1 || ''}${a.line2 ? '<br>' + a.line2 : ''}<br>
      ${a.postalCode || ''} ${a.city || ''} ${a.state ? '(' + a.state + ')' : ''}<br>
      ${a.country || ''}
    </div>
  `;
}

export async function notifyOrderPaid(order) {
  return sendEmail({
    subject: `Conferma ordine #${order.id} — YouBiData`,
    html: shell({
      title: `✅ Ordine ricevuto — grazie!`,
      body: `
        <p>Ciao${order.customer?.name ? ' ' + order.customer.name.split(' ')[0] : ''},</p>
        <p>abbiamo ricevuto il tuo ordine <strong>#${order.id}</strong> e il pagamento è stato confermato.
        Procederemo con la preparazione e ti aggiorneremo quando il pacco sarà in partenza.</p>
        ${itemsTable(order)}
        ${addressBlock(order)}
        ${demoNotice(order)}
      `,
    }),
  });
}

export async function notifyOrderShipped(order) {
  const s = order.shipment;
  if (!s) return { ok: false };
  return sendEmail({
    subject: `Il tuo ordine #${order.id} è in partenza`,
    html: shell({
      title: `🚚 Spedizione in viaggio`,
      accent: '#004085',
      body: `
        <p>Ciao${order.customer?.name ? ' ' + order.customer.name.split(' ')[0] : ''},</p>
        <p>il tuo ordine <strong>#${order.id}</strong> è stato preparato e affidato al corriere
        <strong>${s.courier}</strong>.</p>
        <div style="margin-top:14px;padding:14px;background:#cce5ff;border-radius:6px;font-size:14px;">
          <strong>Tracking:</strong>
          <code style="background:rgba(255,255,255,0.6);padding:2px 6px;border-radius:3px;">${s.trackingNumber}</code><br>
          <span style="font-size:12px;color:#004085;">Potrai seguire la spedizione sul sito del corriere.</span>
        </div>
        ${addressBlock(order)}
        ${demoNotice(order)}
      `,
    }),
  });
}

export async function notifyTrackingUpdate(order, previousStatus) {
  const s = order.shipment;
  if (!s || s.lastStatus === previousStatus) return { ok: false, skipped: true };

  const isDelivered = order.status === 'delivered';
  return sendEmail({
    subject: isDelivered
      ? `🎉 Ordine #${order.id} consegnato`
      : `Aggiornamento spedizione ordine #${order.id}: ${s.lastStatus}`,
    html: shell({
      title: isDelivered ? '🎉 Consegna effettuata!' : '📦 Spedizione aggiornata',
      accent: isDelivered ? '#155724' : '#0071e3',
      body: `
        <p>Ciao${order.customer?.name ? ' ' + order.customer.name.split(' ')[0] : ''},</p>
        <p>lo stato della tua spedizione è cambiato:</p>
        <div style="margin-top:12px;padding:14px;background:#f5f5f7;border-radius:6px;font-size:14px;">
          ${previousStatus ? `<div style="color:#999;text-decoration:line-through;font-size:12px;">${previousStatus}</div>` : ''}
          <strong style="font-size:16px;">${s.lastStatus}</strong>
        </div>
        <p style="font-size:13px;margin-top:14px;">
          <strong>Tracking:</strong> ${s.courier} <code>${s.trackingNumber}</code>
        </p>
        ${demoNotice(order)}
      `,
    }),
  });
}

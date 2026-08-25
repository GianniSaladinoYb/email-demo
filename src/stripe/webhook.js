import express from 'express';
import { stripe } from './client.js';
import { updateOrderStatus, markEventProcessed, getOrder, OrderStatus } from '../orders.js';
import { notifyOrderPaid } from '../email/notifications.js';

const router = express.Router();
const { STRIPE_WEBHOOK_SECRET } = process.env;

// IMPORTANTE: questo router deve essere montato con express.raw({type:'application/json'})
// PRIMA del middleware globale express.json(), altrimenti la signature verify fallisce.
router.post('/', (req, res) => {
  if (!STRIPE_WEBHOOK_SECRET || STRIPE_WEBHOOK_SECRET.startsWith('whsec_xxxx')) {
    console.error('❌ STRIPE_WEBHOOK_SECRET non configurato');
    return res.status(500).send('Webhook secret mancante');
  }

  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('❌ Signature verify fallita:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (!markEventProcessed(event.id)) {
    console.log(`↩️  Evento ${event.id} già processato — skip`);
    return res.json({ received: true, duplicate: true });
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object;
      const orderId = session.metadata?.orderId;
      if (orderId) {
        // Stripe espone sia customer_details che shipping_details.
        // Il primo contiene email/telefono/nome+billing, il secondo l'indirizzo di spedizione.
        const shippingAddress = session.shipping_details
          ? {
              name: session.shipping_details.name,
              line1: session.shipping_details.address?.line1,
              line2: session.shipping_details.address?.line2,
              postalCode: session.shipping_details.address?.postal_code,
              city: session.shipping_details.address?.city,
              state: session.shipping_details.address?.state,
              country: session.shipping_details.address?.country,
            }
          : null;

        updateOrderStatus(orderId, OrderStatus.PAID, {
          paidAt: new Date().toISOString(),
          paymentIntentId: session.payment_intent,
          customer: {
            email: session.customer_details?.email,
            name: session.customer_details?.name,
            phone: session.customer_details?.phone,
          },
          shippingAddress,
        });
        console.log(`✅ Stripe — ordine ${orderId} pagato (session ${session.id})`);
        // Email transazionale "ordine ricevuto" — fire-and-forget, non bloccante
        // sulla risposta al webhook (Stripe vuole 200 entro pochi secondi).
        notifyOrderPaid(getOrder(orderId)).catch((e) => console.error('Email notify error:', e));
      }
      break;
    }
    case 'payment_intent.payment_failed': {
      const pi = event.data.object;
      const orderId = pi.metadata?.orderId;
      if (orderId) {
        updateOrderStatus(orderId, OrderStatus.FAILED, {
          failureReason: pi.last_payment_error?.message,
        });
        console.log(`❌ Stripe — ordine ${orderId} fallito`);
      }
      break;
    }
    default:
      console.log(`ℹ️  Evento Stripe non gestito: ${event.type}`);
  }

  res.json({ received: true });
});

export default router;

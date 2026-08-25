import express from 'express';
import { stripe } from './client.js';
import { getProduct, calcTotalCents } from '../catalog.js';
import { createOrder, OrderStatus } from '../orders.js';

const router = express.Router();
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || 'http://localhost:3000';

router.post('/create-checkout-session', async (req, res) => {
  const { items } = req.body;

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ ok: false, error: 'items[] richiesto' });
  }

  try {
    const totalCents = calcTotalCents(items);
    const order = createOrder({
      items,
      totalCents,
      provider: 'stripe',
      providerRef: null,
    });

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: items.map(({ id, qty }) => {
        const p = getProduct(id);
        return {
          price_data: {
            currency: 'eur',
            product_data: { name: p.name, description: p.description },
            unit_amount: p.priceCents,
          },
          quantity: qty,
        };
      }),
      // Stripe Checkout raccoglie automaticamente l'indirizzo di spedizione
      // se abilitato. Lo arriverà nel webhook checkout.session.completed.
      shipping_address_collection: { allowed_countries: ['IT'] },
      phone_number_collection: { enabled: true },
      // L'ordine viene legato alla sessione tramite metadata: alla ricezione del webhook
      // troviamo l'ordine via session.metadata.orderId.
      metadata: { orderId: order.id },
      success_url: `${PUBLIC_BASE_URL}/success.html?order_id=${order.id}`,
      cancel_url: `${PUBLIC_BASE_URL}/cancel.html?order_id=${order.id}`,
    });

    order.providerRef = session.id;

    return res.json({ ok: true, url: session.url, orderId: order.id });
  } catch (err) {
    console.error('Errore create-checkout-session:', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;

import express from 'express';
import { paypalClient, paypal, centsToDecimalString } from './client.js';
import { getProduct, calcTotalCents } from '../catalog.js';
import { createOrder, findByProviderRef, updateOrderStatus, getOrder, OrderStatus } from '../orders.js';
import { notifyOrderPaid } from '../email/notifications.js';

const router = express.Router();

router.post('/create-order', async (req, res) => {
  const { items } = req.body;

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ ok: false, error: 'items[] richiesto' });
  }

  try {
    const totalCents = calcTotalCents(items);
    const totalStr = centsToDecimalString(totalCents);

    const order = createOrder({
      items,
      totalCents,
      provider: 'paypal',
      providerRef: null,
    });

    const request = new paypal.orders.OrdersCreateRequest();
    request.prefer('return=representation');
    request.requestBody({
      intent: 'CAPTURE',
      purchase_units: [
        {
          reference_id: order.id,
          amount: {
            currency_code: 'EUR',
            value: totalStr,
            breakdown: {
              item_total: { currency_code: 'EUR', value: totalStr },
            },
          },
          items: items.map(({ id, qty }) => {
            const p = getProduct(id);
            return {
              name: p.name,
              quantity: String(qty),
              unit_amount: { currency_code: 'EUR', value: centsToDecimalString(p.priceCents) },
            };
          }),
        },
      ],
    });

    const response = await paypalClient.execute(request);
    order.providerRef = response.result.id;

    return res.json({ ok: true, orderID: response.result.id, internalOrderId: order.id });
  } catch (err) {
    console.error('Errore PayPal create-order:', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

router.post('/capture-order/:orderID', async (req, res) => {
  const { orderID } = req.params;

  try {
    const request = new paypal.orders.OrdersCaptureRequest(orderID);
    request.requestBody({});
    const response = await paypalClient.execute(request);

    const order = findByProviderRef(orderID);
    if (order) {
      const isCompleted = response.result.status === 'COMPLETED';

      // PayPal espone payer (email/nome) e l'indirizzo di spedizione dentro purchase_units[].shipping.
      const payer = response.result.payer || {};
      const shipping = response.result.purchase_units?.[0]?.shipping || {};
      const addr = shipping.address || {};
      const shippingAddress = addr.address_line_1
        ? {
            name: shipping.name?.full_name,
            line1: addr.address_line_1,
            line2: addr.address_line_2,
            postalCode: addr.postal_code,
            city: addr.admin_area_2,
            state: addr.admin_area_1,
            country: addr.country_code,
          }
        : null;

      updateOrderStatus(order.id, isCompleted ? OrderStatus.PAID : OrderStatus.FAILED, {
        paidAt: isCompleted ? new Date().toISOString() : undefined,
        paypalCaptureId: response.result.purchase_units?.[0]?.payments?.captures?.[0]?.id,
        customer: {
          email: payer.email_address,
          name: payer.name ? `${payer.name.given_name || ''} ${payer.name.surname || ''}`.trim() : undefined,
        },
        shippingAddress,
      });
      console.log(`✅ PayPal — ordine ${order.id} ${response.result.status}`);
      if (isCompleted) {
        notifyOrderPaid(getOrder(order.id)).catch((e) => console.error('Email notify error:', e));
      }
      return res.json({ ok: true, status: response.result.status, internalOrderId: order.id });
    }

    return res.json({ ok: true, status: response.result.status });
  } catch (err) {
    console.error('Errore PayPal capture-order:', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;

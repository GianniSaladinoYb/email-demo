import express from 'express';
import { nanoid } from 'nanoid';
import { qapla } from './client.js';
import { getOrder, attachShipment, updateShipmentTracking, OrderStatus } from '../orders.js';
import { notifyOrderShipped, notifyTrackingUpdate } from '../email/notifications.js';

const router = express.Router();

// Per la demo: ordine deve essere "paid" prima di poter creare una spedizione.
// In produzione: lo farebbe automaticamente il sistema di gestione magazzino.

router.post('/create-shipment/:orderId', async (req, res) => {
  const order = getOrder(req.params.orderId);
  if (!order) return res.status(404).json({ ok: false, error: 'Ordine non trovato' });
  if (order.status !== OrderStatus.PAID && order.status !== OrderStatus.SHIPPED) {
    return res.status(400).json({ ok: false, error: `Ordine in stato "${order.status}" — solo ordini "paid" possono essere spediti` });
  }
  if (order.shipment) {
    return res.json({ ok: true, alreadyShipped: true, shipment: order.shipment });
  }

  // Tracking number finto generato localmente. Nella realtà arriverebbe dal corriere
  // dopo la stampa della LDV (lettera di vettura).
  const trackingNumber = `DEMO${nanoid(12).toUpperCase()}`;
  const courier = req.body?.courier || 'BRT';

  try {
    const payload = await qapla.pushShipment([
      {
        trackingNumber,
        courier,
        shipDate: new Date().toISOString().slice(0, 10),
        orderNumber: order.id,
        // Recipient finto. In prod arriverebbe dal customer dell'ordine.
        email: 'demo@youbidata.com',
        name: 'Demo Customer',
      },
    ]);

    // Qapla' ha un doppio livello di esito: top-level OK significa "request well-formed",
    // ma ogni singola spedizione può avere result KO (es. corriere non valido).
    const perShipment = payload?.shipments?.[0];
    if (!perShipment || perShipment.result !== 'OK') {
      console.error(`❌ Qapla — spedizione rifiutata: ${perShipment?.error || 'errore sconosciuto'}`);
      return res.status(400).json({ ok: false, error: `Qapla' ha rifiutato la spedizione: ${perShipment?.error || 'errore sconosciuto'}` });
    }

    const updated = attachShipment(order.id, { trackingNumber, courier });
    console.log(`📦 Qapla — spedizione creata per ordine ${order.id}: ${courier} ${trackingNumber} (Qapla id ${perShipment.id})`);
    notifyOrderShipped(updated).catch((e) => console.error('Email notify error:', e));
    return res.json({ ok: true, shipment: updated.shipment });
  } catch (err) {
    console.error('Errore Qapla pushShipment:', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

router.get('/track/:orderId', async (req, res) => {
  const order = getOrder(req.params.orderId);
  if (!order) return res.status(404).json({ ok: false, error: 'Ordine non trovato' });
  if (!order.shipment) {
    return res.status(400).json({ ok: false, error: 'Nessuna spedizione associata' });
  }

  try {
    const payload = await qapla.getShipment(order.shipment.trackingNumber);
    const shipment = payload?.shipments?.[0];
    if (!shipment) {
      return res.status(404).json({ ok: false, error: 'Spedizione non trovata su Qapla' });
    }

    // Stato normalizzato Qapla' (ATTESA ELABORAZIONE / IN TRANSITO / CONSEGNATA / ecc).
    const lastStatus = shipment.status?.qaplaStatus?.status || 'Sconosciuto';
    const delivered = Boolean(shipment.isDelivered);
    // Eventi di tracking dettagliati: il campo varia. Per ora estraiamo quello che troviamo.
    const events = shipment.status?.tracking || shipment.tracking || [];

    const previousStatus = order.shipment.lastStatus;
    const updated = updateShipmentTracking(order.id, { lastStatus, events, delivered });
    // Email solo se lo stato è cambiato davvero (evita spam ad ogni refresh).
    if (lastStatus !== previousStatus) {
      notifyTrackingUpdate(updated, previousStatus).catch((e) => console.error('Email notify error:', e));
    }
    return res.json({
      ok: true,
      shipment: updated.shipment,
      courierUrl: shipment.courier?.trackingUrl,
      publicUrl: `https://tracking.qapla.it${shipment.url}`,
    });
  } catch (err) {
    console.error('Errore Qapla getShipment:', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

router.get('/couriers', async (_req, res) => {
  try {
    const payload = await qapla.getCouriers();
    // Limito a 30 corrieri più rilevanti per IT per non saturare la UI.
    const italianFirst = (payload.couriers || []).filter(
      (c) => c.country === 'IT' || ['BRT', 'GLS', 'POSTE-ITALIANE', 'SDA', 'TNT', 'DHL', 'FEDEX', 'UPS'].includes(c.code),
    );
    res.json({ ok: true, count: italianFirst.length, couriers: italianFirst });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;

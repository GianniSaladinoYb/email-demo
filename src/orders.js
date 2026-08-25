import { nanoid } from 'nanoid';

// Store ordini in-memory. In produzione: Postgres con tabelle orders + order_items + payments.
const orders = new Map();
const processedEvents = new Set();

export const OrderStatus = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  PAID: 'paid',
  SHIPPED: 'shipped',
  DELIVERED: 'delivered',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
};

export function createOrder({ items, totalCents, provider, providerRef }) {
  const id = nanoid(10);
  const order = {
    id,
    items,
    totalCents,
    provider,
    providerRef,
    status: OrderStatus.PENDING,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  orders.set(id, order);
  return order;
}

export function getOrder(id) {
  return orders.get(id);
}

export function listOrders() {
  // Più recenti prima.
  return [...orders.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function findByProviderRef(providerRef) {
  for (const order of orders.values()) {
    if (order.providerRef === providerRef) return order;
  }
  return null;
}

export function updateOrderStatus(id, status, extra = {}) {
  const order = orders.get(id);
  if (!order) return null;
  Object.assign(order, extra, { status, updatedAt: new Date().toISOString() });
  return order;
}

// Idempotenza webhook: ritorna true se l'evento è nuovo, false se già processato.
export function markEventProcessed(eventId) {
  if (processedEvents.has(eventId)) return false;
  processedEvents.add(eventId);
  return true;
}

export function attachFiscalReceipt(orderId, { uuid, status, transactionId, documentNumber, documentDate }) {
  const order = orders.get(orderId);
  if (!order) return null;
  order.fiscalReceipt = {
    uuid,
    status,
    transactionId,
    documentNumber,
    documentDate,
    transmittedAt: new Date().toISOString(),
  };
  order.updatedAt = new Date().toISOString();
  return order;
}

export function attachShipment(orderId, { trackingNumber, courier }) {
  const order = orders.get(orderId);
  if (!order) return null;
  order.shipment = {
    trackingNumber,
    courier,
    createdAt: new Date().toISOString(),
    lastStatus: null,
    events: [],
  };
  order.status = OrderStatus.SHIPPED;
  order.updatedAt = new Date().toISOString();
  return order;
}

export function updateShipmentTracking(orderId, { lastStatus, events, delivered }) {
  const order = orders.get(orderId);
  if (!order || !order.shipment) return null;
  order.shipment.lastStatus = lastStatus;
  order.shipment.events = events;
  order.shipment.lastCheckedAt = new Date().toISOString();
  if (delivered) {
    order.status = OrderStatus.DELIVERED;
  }
  order.updatedAt = new Date().toISOString();
  return order;
}

// Catalogo finto per la demo. In produzione verrebbe da DB.
// Prezzi in centesimi (formato Stripe). Helper per conversione PayPal in src/paypal/client.js.

export const CATALOG = [
  {
    id: 'sku-001',
    name: 'Caffè YouBiData 250g',
    description: 'Miscela arabica 100% tostata in Italia',
    priceCents: 1290,
    image: 'https://images.unsplash.com/photo-1559056199-641a0ac8b55e?w=400',
  },
  {
    id: 'sku-002',
    name: 'Tazza espresso',
    description: 'Porcellana bianca, set da 2',
    priceCents: 1890,
    image: 'https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?w=400',
  },
];

export function getProduct(id) {
  return CATALOG.find((p) => p.id === id);
}

export function calcTotalCents(items) {
  return items.reduce((sum, { id, qty }) => {
    const p = getProduct(id);
    if (!p) throw new Error(`Prodotto non trovato: ${id}`);
    return sum + p.priceCents * qty;
  }, 0);
}

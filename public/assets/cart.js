const productsEl = document.getElementById('products');
const totalEl = document.getElementById('total');
const stripeBtn = document.getElementById('stripeBtn');

const eur = (cents) => (cents / 100).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });

let catalog = [];
const quantities = {};

async function loadCatalog() {
  const res = await fetch('/api/catalog');
  catalog = await res.json();
  catalog.forEach((p) => (quantities[p.id] = 1));
  renderProducts();
  updateTotal();
}

function renderProducts() {
  productsEl.innerHTML = catalog
    .map(
      (p) => `
    <div class="product">
      <img src="${p.image}" alt="${p.name}" onerror="this.style.background='#ddd';this.src=''">
      <div class="info">
        <div class="name">${p.name}</div>
        <div class="desc">${p.description}</div>
        <div class="price">${eur(p.priceCents)}</div>
      </div>
      <input class="qty" type="number" min="0" max="10" value="1" data-id="${p.id}">
    </div>`
    )
    .join('');

  productsEl.querySelectorAll('.qty').forEach((input) => {
    input.addEventListener('input', (e) => {
      const id = e.target.dataset.id;
      quantities[id] = Math.max(0, parseInt(e.target.value || '0', 10));
      updateTotal();
    });
  });
}

function getItems() {
  return Object.entries(quantities)
    .filter(([, qty]) => qty > 0)
    .map(([id, qty]) => ({ id, qty }));
}

function updateTotal() {
  const total = catalog.reduce((sum, p) => sum + p.priceCents * (quantities[p.id] || 0), 0);
  totalEl.textContent = eur(total);
  const hasItems = total > 0;
  stripeBtn.disabled = !hasItems;
}

stripeBtn.addEventListener('click', async () => {
  stripeBtn.disabled = true;
  stripeBtn.textContent = 'Apertura Stripe…';
  try {
    const res = await fetch('/api/stripe/create-checkout-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: getItems() }),
    });
    const data = await res.json();
    if (data.ok && data.url) {
      window.location = data.url;
    } else {
      alert('Errore Stripe: ' + (data.error || 'sconosciuto'));
      stripeBtn.disabled = false;
      stripeBtn.textContent = 'Paga con Stripe (carta) →';
    }
  } catch (err) {
    alert('Errore di rete: ' + err.message);
    stripeBtn.disabled = false;
    stripeBtn.textContent = 'Paga con Stripe (carta) →';
  }
});

// ─────────────────────────────────────────────
// PayPal SDK — caricato dinamicamente con il clientId dal backend.
// ─────────────────────────────────────────────
async function setupPayPal() {
  const cfg = await fetch('/api/paypal-config').then((r) => r.json());
  if (!cfg.clientId || cfg.clientId.startsWith('xxxx')) {
    document.getElementById('paypal-button-container').innerHTML =
      '<div style="font-size:13px;color:#999;text-align:center;padding:14px;">PayPal non configurato (controlla .env)</div>';
    return;
  }

  const script = document.createElement('script');
  script.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(cfg.clientId)}&currency=EUR&intent=capture`;
  script.onload = () => {
    window.paypal
      .Buttons({
        style: { layout: 'horizontal', height: 45, tagline: false },
        createOrder: async () => {
          const res = await fetch('/api/paypal/create-order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ items: getItems() }),
          });
          const data = await res.json();
          if (!data.ok) throw new Error(data.error);
          window.__paypalInternalOrderId = data.internalOrderId;
          return data.orderID;
        },
        onApprove: async (data) => {
          const res = await fetch(`/api/paypal/capture-order/${data.orderID}`, { method: 'POST' });
          const out = await res.json();
          const internalId = out.internalOrderId || window.__paypalInternalOrderId;
          window.location = `/success.html?order_id=${internalId}`;
        },
        onCancel: () => {
          const internalId = window.__paypalInternalOrderId;
          window.location = internalId ? `/cancel.html?order_id=${internalId}` : '/cancel.html';
        },
        onError: (err) => {
          alert('Errore PayPal: ' + err.message);
        },
      })
      .render('#paypal-button-container');
  };
  document.body.appendChild(script);
}

loadCatalog();
setupPayPal();

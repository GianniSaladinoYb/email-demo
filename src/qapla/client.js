// Wrapper minimale per le chiamate Qapla'.
// Auth via query parameter `apiKey=...` (convenzione Qapla, non bearer token).
// Versione API attiva: 1.2 (i docs parlano della 1.3 ma in produzione risponde 404).

const QAPLA_BASE = 'https://api.qapla.it/1.2';
const { QAPLA_API_KEY } = process.env;

if (!QAPLA_API_KEY || QAPLA_API_KEY.length < 20) {
  console.warn('⚠️  QAPLA_API_KEY non configurata. Gli endpoint /api/qapla/* falliranno.');
}

async function qaplaGet(endpoint, params = {}) {
  const url = new URL(`${QAPLA_BASE}${endpoint}`);
  url.searchParams.set('apiKey', QAPLA_API_KEY || '');
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  const res = await fetch(url);
  const data = await res.json();
  return unwrap(endpoint, data);
}

async function qaplaPost(endpoint, body) {
  // Su POST, Qapla' vuole l'apiKey DENTRO al body, non in query string.
  // Comportamento incoerente con i GET, ma è così.
  const url = new URL(`${QAPLA_BASE}${endpoint}`);
  const payload = { apiKey: QAPLA_API_KEY || '', ...body };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  return unwrap(endpoint, data);
}

// Qapla' wrappa ogni risposta in { <NomeMetodo>: { result, error, ... } }.
// Estraggo il contenuto utile e propago errori come throw.
function unwrap(endpoint, data) {
  const key = Object.keys(data)[0];
  const payload = data[key];
  if (!payload || payload.result !== 'OK') {
    throw new Error(`Qapla' ${endpoint}: ${payload?.error || 'errore sconosciuto'}`);
  }
  return payload;
}

export const qapla = {
  getCouriers: () => qaplaGet('/getCouriers/'),
  getShipment: (trackingNumber) => qaplaGet('/getShipment/', { trackingNumber }),
  pushShipment: (shipments) => qaplaPost('/pushShipment/', { pushShipment: shipments }),
};

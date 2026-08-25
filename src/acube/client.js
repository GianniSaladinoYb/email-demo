// Wrapper per le chiamate ACube (corrispettivi telematici / scontrino elettronico).
// Auth: login → JWT valido 24h. Il token viene messo in cache e ri-richiesto solo
// quando manca o è prossimo alla scadenza (no refresh token disponibile lato ACube).

const AUTH_URL = 'https://common-sandbox.api.acubeapi.com';
const API_URL = 'https://api-sandbox.acubeapi.com';

const { ACUBE_EMAIL, ACUBE_PASSWORD } = process.env;

if (!ACUBE_EMAIL || !ACUBE_PASSWORD) {
  console.warn('⚠️  ACUBE_EMAIL / ACUBE_PASSWORD non configurate. Gli endpoint /api/acube/* falliranno.');
}

let cachedToken = null;
let tokenExpiresAt = 0;

async function getToken() {
  // Rinnovo se manca o scade entro 60s (margine di sicurezza).
  if (cachedToken && Date.now() < tokenExpiresAt - 60_000) return cachedToken;

  const res = await fetch(`${AUTH_URL}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ACUBE_EMAIL, password: ACUBE_PASSWORD }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`ACube login ${res.status}: ${text}`);

  cachedToken = JSON.parse(text).token;
  tokenExpiresAt = Date.now() + 24 * 60 * 60 * 1000; // JWT valido 24h
  return cachedToken;
}

async function request(method, path, { body, accept = 'application/json' } = {}) {
  const token = await getToken();
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: accept,
      ...(body && { 'Content-Type': 'application/json' }),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return res;
}

export const acube = {
  // Setup soggetto emittente (idempotente lato chiamante).
  async createBusinessRegistry(fiscalId) {
    const res = await request('POST', '/business-registry-configurations', {
      body: { fiscal_id: fiscalId, name: 'Coltivare', receipts_enabled: true },
    });
    if (!res.ok) throw new Error(`ACube BRC ${res.status}: ${await res.text()}`);
    return res.json();
  },

  async getBusinessRegistry(fiscalId) {
    const res = await request('GET', `/business-registry-configurations/${fiscalId}`);
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`ACube GET BRC ${res.status}: ${await res.text()}`);
    return res.json();
  },

  async createReceipt(payload) {
    const res = await request('POST', '/receipts', { body: payload });
    if (!res.ok) throw new Error(`ACube POST /receipts ${res.status}: ${await res.text()}`);
    return res.json();
  },

  async getReceipt(uuid) {
    const res = await request('GET', `/receipts/${uuid}`);
    if (!res.ok) throw new Error(`ACube GET /receipts/${uuid} ${res.status}: ${await res.text()}`);
    return res.json();
  },

  // CSV report degli scontrini emessi a partire da `fromDate` (YYYY-MM-DD).
  async getReport(fromDate) {
    const res = await request('GET', `/receipts/report?created_at[after]=${fromDate}`, {
      accept: 'text/csv',
    });
    if (!res.ok) throw new Error(`ACube report ${res.status}: ${await res.text()}`);
    return res.text();
  },
};

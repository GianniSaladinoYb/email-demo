# Email Demo · YouBiData

Demo locale per testare l'invio di email transazionali via [Resend](https://resend.com).

## Setup (5 minuti)

### 1. Crea account Resend

1. Vai su https://resend.com/signup e registrati (puoi usare GitHub o Google)
2. Conferma l'email di registrazione
3. Vai su https://resend.com/api-keys → **Create API Key**
   - Nome: `email-demo-local`
   - Permission: `Sending access`
4. Copia la key (inizia con `re_...`) — **la vedrai una volta sola**

### 2. Configura il progetto

Apri il file `.env` (già creato per te) e incolla la API key:

```
RESEND_API_KEY=re_la_tua_key_qui
MAIL_FROM=onboarding@resend.dev
PORT=3000
```

### 3. Avvia il server

```bash
npm start
```

Apri http://localhost:3000 nel browser, compila il form e invia.

## ⚠️ Limitazione modalità test

Con il mittente `onboarding@resend.dev` (default Resend test), puoi inviare **SOLO all'indirizzo email del tuo account Resend**. È una protezione anti-spam.

Per inviare ad altri destinatari devi **verificare un dominio**:

### Verificare youbidata.com (per produzione)

1. Resend Dashboard → **Domains** → **Add Domain** → `youbidata.com`
2. Aggiungi i record DNS che Resend ti mostra (SPF, DKIM, DMARC) sul tuo provider DNS
3. Aspetta la verifica (di solito pochi minuti)
4. Cambia `MAIL_FROM` nel `.env` in qualcosa tipo `proposte@youbidata.com`
5. Riavvia il server

A quel punto puoi inviare a qualunque destinatario.

## Struttura del progetto

```
email-demo/
├── server.js          → Express server + endpoint POST /send
├── public/index.html  → Frontend con form di test
├── package.json
├── .env               → API key (non committare!)
└── .env.example       → Template di esempio
```

## Endpoint API

`POST /send`

```json
{
  "to": "destinatario@esempio.com",
  "subject": "Oggetto",
  "message": "Corpo del messaggio"
}
```

Risposta success:
```json
{ "ok": true, "id": "..." }
```

## Free tier Resend

- **100 email/giorno** (3.000/mese) — copre i ~50/giorno previsti
- Nessun limite di tempo, gratis per sempre
- Se servono volumi maggiori: $20/mese per 50.000 email

---

# 💳 Demo pagamenti Stripe + PayPal (sandbox)

Lo stesso server espone anche una **demo di pagamenti** all'URL [http://localhost:3000/cart.html](http://localhost:3000/cart.html). È un carrello fittizio con due prodotti e due opzioni di pagamento: **Stripe Checkout** (carte di credito, Apple Pay, Google Pay) e **PayPal**. **Tutto in modalità test/sandbox: nessun denaro reale viene mosso.**

## Setup (10 minuti)

### 1. Stripe — ottieni le chiavi di test

1. Vai su [dashboard.stripe.com](https://dashboard.stripe.com/test/apikeys) e registrati (puoi usare GitHub o email)
2. Vai su **Developers → API keys** (in alto a destra deve esserci il toggle "Test mode" attivo)
3. Copia:
   - **Publishable key** (`pk_test_...`) → mettila in `STRIPE_PUBLISHABLE_KEY`
   - **Secret key** (`sk_test_...`) → mettila in `STRIPE_SECRET_KEY`
4. Lo `STRIPE_WEBHOOK_SECRET` viene generato al passo 3 (Stripe CLI)

### 2. PayPal — crea un'app sandbox

1. Vai su [developer.paypal.com](https://developer.paypal.com) e accedi (account PayPal personale OK)
2. **Dashboard → Apps & Credentials → Sandbox** → **Create App**
   - Nome: `youbidata-demo`
   - Type: Merchant
3. Copia **Client ID** e **Secret** nel `.env` (`PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`)
4. **Crea un account buyer di test**: Dashboard → **Testing Tools → Sandbox Accounts** → uno dei `personal` esistenti va bene. Usa quelle credenziali per fare login nel popup PayPal durante il test (NON il tuo account vero).

### 3. Installa Stripe CLI (per ricevere webhook in locale)

Mac: `brew install stripe/stripe-cli/stripe`
Altre piattaforme: [stripe.com/docs/stripe-cli](https://stripe.com/docs/stripe-cli)

Poi:
```bash
stripe login                                                    # autenticazione browser una tantum
stripe listen --forward-to localhost:3000/webhooks/stripe       # mantieni questo terminale aperto
```

L'output mostra una riga tipo `Your webhook signing secret is whsec_xxxxx`. **Copiala nel `.env`** come `STRIPE_WEBHOOK_SECRET`, poi riavvia il server.

### 4. Installa dipendenze e avvia

```bash
npm install
npm start
```

Apri [http://localhost:3000/cart.html](http://localhost:3000/cart.html).

## Come testare

### Stripe — happy path
1. Seleziona almeno 1 prodotto, click su **Paga con Stripe**
2. Vieni redirezionato a Checkout Stripe
3. Inserisci carta `4242 4242 4242 4242`, scadenza qualsiasi nel futuro, CVC qualsiasi
4. Vieni ricondotto a `/success.html` — la pagina fa polling, dopo ~1s vedi stato **paid**
5. Nel terminale di Stripe CLI vedi l'evento `checkout.session.completed` ricevuto

### Stripe — SCA (3D Secure)
- Carta: `4000 0027 6000 3184` → richiede challenge 3DS → clicca "Complete authentication"

### Stripe — fallimento
- Carta: `4000 0000 0000 9995` (fondi insufficienti) → redirect a `/cancel.html`

### Stripe — idempotenza webhook
Nel terminale di Stripe CLI:
```bash
stripe events resend evt_xxxxxxxxxxxx   # id di un evento già processato
```
Il server logga `↩️  Evento ... già processato — skip` e l'ordine non viene duplicato.

### PayPal — happy path
1. Click su **PayPal** nel carrello
2. Si apre il popup PayPal sandbox → login con l'account buyer creato al setup
3. Conferma il pagamento → redirect a `/success.html` con stato **paid**

> Lista completa carte di test Stripe sempre aggiornata: [stripe.com/docs/testing](https://stripe.com/docs/testing)

## Architettura della demo

```
┌─────────────────┐        ┌──────────────────────────────┐
│  cart.html      │ ─POST→ │ /api/stripe/create-checkout  │ ──→ Stripe API
│  cart.js        │        │   (crea ordine pending)      │
└─────────────────┘        └──────────────────────────────┘
        │                                                          ↓
        │                                          ┌─────────────────────┐
        │                                          │  Stripe Checkout    │
        │ redirect ←──────────────────────────────│  (pagina hosted)    │
        ↓                                          └─────────────────────┘
┌─────────────────┐                                          ↓
│  success.html   │                          ┌──────────────────────────┐
│  (polling)      │ ←─ aggiorna ordine ←─── │ /webhooks/stripe         │
└─────────────────┘                          │ (signature verify, dedup)│
                                             └──────────────────────────┘
                                                          ↑
                                                  Stripe CLI listen
```

Per PayPal il flusso è analogo ma senza redirect (popup): `createOrder` → user approva nel popup → `captureOrder` → success.

## Struttura file (parte pagamenti)

```
src/
├── catalog.js                → prodotti hardcoded + helper totale
├── orders.js                 → store in-memory + dedup eventi
├── stripe/
│   ├── client.js             → init SDK
│   ├── checkout.js           → POST /api/stripe/create-checkout-session
│   └── webhook.js            → POST /webhooks/stripe
└── paypal/
    ├── client.js             → init SDK sandbox
    └── orders.js             → POST /api/paypal/create-order, capture-order

public/
├── cart.html                 → carrello + bottoni pagamento
├── success.html              → polling stato ordine
├── cancel.html               → pagina annullamento
└── assets/cart.js            → logica frontend (Stripe redirect + PayPal SDK)
```

## Troubleshooting

| Sintomo | Probabile causa | Fix |
|---|---|---|
| `Webhook Error: No signatures found...` | `STRIPE_WEBHOOK_SECRET` mancante o sbagliato | Copialo dall'output di `stripe listen` |
| `Webhook Error: signature... no match` | Body parser ha mangiato il raw body | Verifica che `/webhooks/stripe` sia montato con `express.raw()` PRIMA di `express.json()` |
| PayPal popup non si apre | Bloccato dal browser | Consenti popup su `localhost:3000` |
| `Login required` su PayPal sandbox | Stai usando l'account vero | Usa le credenziali del buyer sandbox da developer.paypal.com → Sandbox Accounts |
| Success page resta su "processing" | Webhook non sta arrivando | Verifica che `stripe listen` sia attivo in un altro terminale |

## Analisi tecnico-strategica completa

Per la valutazione production-ready (confronto provider, compliance IT, costi, roadmap), vedi [docs/analisi-ecommerce-it.md](docs/analisi-ecommerce-it.md).

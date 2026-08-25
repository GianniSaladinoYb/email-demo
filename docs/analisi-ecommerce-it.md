# Analisi tecnico-strategica — E-commerce B2C Italia

> **Documento di proposta · YouBiData · Maggio 2026**
> Analisi per l'integrazione di un sistema di pagamenti online in un nuovo e-commerce B2C destinato esclusivamente al mercato italiano.

---

## 1. Executive summary

**In 10 righe:**

- Raccomandiamo **Stripe + PayPal** come stack pagamenti. Stripe per carte / Apple Pay / Google Pay (oltre al riuso dell'account che il cliente già usa per i POS fisici), PayPal come SDK separato (~40% degli utenti consumer italiani lo preferisce).
- Per la piattaforma e-commerce, l'orientamento iniziale è **Shopify** se la priorità è time-to-market, **Medusa.js + Next.js storefront** se serve customizzazione spinta e indipendenza dal vendor. Decisione subordinata alle risposte del cliente (vedi §11).
- Stima realistica per un MVP production-ready: **3-4 mesi** con team di 1-2 sviluppatori full-time.
- I tre punti su cui serve chiarezza dal cliente prima di chiudere la proposta:
  1. **Volumi attesi anno 1** (ordini/mese, valore medio ordine)
  2. **Account Stripe Terminal esistente**: stessa ragione sociale del nuovo e-commerce?
  3. **Software gestionale/fatturazione** già in uso (FattureInCloud, TeamSystem, altro)?

---

## 2. Requisiti e assunzioni

| Dimensione | Valore | Note |
|---|---|---|
| Modello | B2C one-shot (carrello classico) | Niente abbonamenti, niente B2B |
| Mercato | Italia | EUR, niente cross-border EU/extra-EU |
| Pagamenti must-have | Carte + PayPal | Apple/Google Pay automatici con Stripe |
| Volume atteso | **DA CHIEDERE** | Impatta scelta stack e tier di pricing |
| AOV (Average Order Value) | **DA CHIEDERE** | Impatta convenienza dei piani volume PayPal |
| Catalogo SKU | **DA CHIEDERE** | Varianti taglia/colore? Magazzino integrato? |
| Spedizioni | **DA CHIEDERE** | Corriere preferito, accordi commerciali |

**Assunzioni operative (da validare):**
- L'utente medio è un consumatore privato italiano senza P.IVA → la fattura elettronica B2C **non è obbligatoria** (servono solo i corrispettivi telematici).
- Il cliente ha già un commercialista / fornitore di servizi fiscali → ci appoggeremo a un provider per FE/conservazione (no integrazione SDI diretta).
- Niente vincoli particolari di SLA / disponibilità che imporrebbero infrastruttura ridondata multi-region.

---

## 3. Stack e-commerce: confronto e raccomandazione

### 3.1 Opzioni valutate

| Piattaforma | Tipo | Time-to-market | Costo licenze | Customizzazione | Indipendenza |
|---|---|---|---|---|---|
| **Shopify** | SaaS hosted | ⭐⭐⭐⭐⭐ | $29-299/mese + fee transazione | ⭐⭐ (Liquid + app) | Bassa (lock-in) |
| **Shopify Plus** | SaaS enterprise | ⭐⭐⭐⭐ | da $2.300/mese | ⭐⭐⭐ | Bassa |
| **WooCommerce** | Plugin WordPress | ⭐⭐⭐ | Free + hosting | ⭐⭐⭐ | Media |
| **Medusa.js** | Headless OSS | ⭐⭐⭐ | Free + hosting | ⭐⭐⭐⭐⭐ | Alta |
| **Next.js + DB custom** | Full custom | ⭐⭐ | Free + hosting | ⭐⭐⭐⭐⭐ | Massima |

### 3.2 Matrice decisionale per il caso YouBiData

| Criterio | Shopify | WooCommerce | Medusa | Custom |
|---|---|---|---|---|
| Tempo per MVP | 4-6 sett | 6-8 sett | 10-12 sett | 14-18 sett |
| Costo annuale licenze (volume basso) | ~€1.500 + fee | €0 + plugin | €0 | €0 |
| Stripe Terminal integrato | No (Shopify Payments) | Sì via plugin | Sì nativo | Sì |
| Fatturazione elettronica IT (plugin/integrazioni mature) | Buoni plugin | Eccellente | Da costruire | Da costruire |
| Performance core web vitals | Buone | Variabili | Ottime (Next.js) | Ottime |
| Costo manutenzione | Basso | Medio (aggiornamenti) | Medio | Alto |
| Rischio vendor lock-in | Alto | Basso | Nullo | Nullo |

### 3.3 Raccomandazione

**Scenario A — se priorità è time-to-market e volumi bassi/medi**: **Shopify**.
Trade-off: costi mensili + fee aggiuntive se non si usa Shopify Payments (incompatibile con la strategia di riuso account Stripe del cliente). Lock-in significativo.

**Scenario B — se priorità è controllo, integrazione col mondo Stripe esistente, scalabilità**: **Medusa.js + Next.js storefront**.
Trade-off: 2x del tempo iniziale, ma ZERO costi di licenza e flessibilità totale per integrare il gestionale del cliente e l'account Stripe Terminal esistente.

**La nostra raccomandazione di base è Scenario B (Medusa + Next.js)** perché:
1. Permette di **riusare l'account Stripe esistente** del cliente (essenziale per la consistenza POS/online).
2. Non paga commissioni Shopify aggiuntive sopra a quelle di Stripe.
3. Lascia spazio a integrazioni custom con il gestionale italiano del cliente.
4. La differenza di time-to-market (~4 settimane) è gestibile.

→ **Da validare in funzione delle risposte alle domande aperte (§11).**

---

## 4. Payment provider: confronto

### 4.1 Stripe in Italia

**Pricing transazionale (verificato a maggio 2026 su [stripe.com/it/pricing](https://stripe.com/it/pricing) — sempre da riverificare prima della firma del contratto):**

| Tipo carta | Commissione |
|---|---|
| Carte UE standard (consumer) | 1.5% + €0.25 |
| Carte UE premium (Amex, business, corporate) | 2.5% + €0.25 |
| Carte extra-UE | 3.25% + €0.25 |
| Conversione valuta | +2% |
| Chargeback (disputa persa) | €15 |
| Refund | Commissione transazione non rimborsata |

**Pro:**
- API e SDK best-in-class del settore (developer experience superiore a tutti i competitor IT)
- SCA/3DS2 gestito automaticamente
- Apple Pay e Google Pay senza configurazione aggiuntiva
- **Stripe Terminal già in uso dal cliente** → forte argomento per la consistenza
- Stripe Radar (anti-frode) incluso senza costi base
- Dashboard operativo molto curato
- Connettori nativi con Shopify, Medusa, WooCommerce

**Contro:**
- Non supporta nativamente metodi bancari italiani come MyBank/bonifico immediato
- Non supporta nativamente Satispay (importante per la fascia 18-35)
- PayPal non passa tramite Stripe in IT → integrazione separata necessaria

**Su Stripe Terminal account reuse:** se la ragione sociale è la stessa, **riusare l'account** dà:
- Customer 360 unificato (un acquirente che compra in negozio E online è lo stesso customer Stripe)
- Report aggregati (vendite POS + online in un'unica dashboard)
- Una sola gestione di chargeback, refund, payouts
- Una sola compliance KYC

Se la ragione sociale è diversa → **account separato obbligatorio**. Resta il vantaggio di un'unica gestione tecnica/operativa, ma niente customer dedup.

### 4.2 PayPal

**Pricing (commerciale standard IT, [paypal.com/it/business/fees](https://www.paypal.com/it/webapps/mpp/merchant-fees)):**

| Voce | Commissione |
|---|---|
| Pagamento commerciale IT | 3.4% + €0.35 |
| Sconto piani volume (>€2.500/mese) | scende fino a 1.8% |
| Chargeback | €20 |
| Refund | Commissione non rimborsata |

**Pro:**
- ~40% degli acquirenti consumer italiani preferisce PayPal → escluderlo significa perdere conversioni
- "Buyer Protection" PayPal aumenta la fiducia dell'acquirente
- Include automaticamente **PayPal Pay Later (3 rate senza interessi)** se attivato — utile per AOV medio-alto
- Account business setup veloce, integrazione SDK ben documentata

**Contro:**
- Commissioni più alte di Stripe
- L'integrazione è separata (doppio set di webhook, doppio set di credenziali)
- Sandbox notoriamente instabile (account buyer che spariscono, popup flaky)
- Lock-in sul flow di pagamento (UX dettata da PayPal, poco customizzabile)
- SDK Node ufficiale (`@paypal/checkout-server-sdk`) in maintenance mode — c'è il nuovo **PayPal Server SDK** ma ancora giovane

### 4.3 Alternative italiane

| Provider | Quando ha senso |
|---|---|
| **Nexi/XPay** | Se servono partner bancari italiani consolidati (MyBank, bonifico immediato). UX checkout datata, integrazione meno developer-friendly. |
| **Adyen** | Solo a volumi enterprise (>€500k/anno). Pricing competitivo a scala, overkill iniziale. |
| **Satispay** | Forte in fascia 18-35, integrazione Satispay Business separata. Da valutare in fase 2 se i dati di conversione lo giustificano. |
| **Klarna** | Pay-in-3 / Pay later. Disponibile via Stripe come metodo aggiuntivo — utile per AOV >€100. |

### 4.4 Raccomandazione provider

**MVP (lancio)**: **Stripe + PayPal**.
**Fase 2 (3-6 mesi post-lancio)**: aggiungere **Satispay** se i dati di abbandono carrello indicano richiesta da utenti giovani; valutare **Klarna** se l'AOV reale supera i €100.

---

## 5. Payment methods da abilitare

| Metodo | Quota mercato IT (stima) | Via | Priorità | Note |
|---|---|---|---|---|
| Carte credito/debito | ~50% | Stripe | 1 | Visa, Mastercard, Amex |
| PayPal account | ~40% | PayPal SDK | 1 | Include Pay Later automatico |
| Apple Pay | ~15% | Stripe (auto) | 1 | Zero config su Checkout |
| Google Pay | ~5% | Stripe (auto) | 1 | Zero config su Checkout |
| Satispay | ~10% in fascia 18-35 | Integrazione separata | 2 | Decidere post-launch |
| Klarna (Pay in 3) | Minoritario | Stripe | 2 | Valutare se AOV >€100 |
| Bonifico immediato (MyBank) | Minoritario | Solo via Nexi | 3 | Solo se richiesta cliente |
| **SEPA Direct Debit** | — | — | **EVITARE** | Chargeback fino a 8 settimane, rischio elevato per B2C |
| Contrassegno | Minoritario in declino | Logica custom + corriere | 3 | Non è pagamento online — gestione operativa lato magazzino |

> Le quote sono stime indicative basate su survey pubbliche (Casaleggio, Netcomm). Vanno tarate sui dati reali del cliente nei primi 3 mesi.

---

## 6. Architettura raccomandata

### 6.1 Diagramma logico

```
┌──────────────────┐
│  Storefront      │   Next.js (SSR/ISR) — SEO catalogo
│  (browser)       │
└────────┬─────────┘
         │ REST/GraphQL
         ▼
┌──────────────────┐         ┌─────────────┐
│  Backend API     │ ◀─────▶ │  Postgres   │
│  (Medusa/Node)   │         │  (RDS/Neon) │
└────────┬─────────┘         └─────────────┘
         │
    ┌────┴───────┬──────────────┬────────────────┐
    ▼            ▼              ▼                ▼
┌─────────┐ ┌─────────┐  ┌────────────┐  ┌──────────────┐
│ Stripe  │ │ PayPal  │  │ Provider   │  │ Resend       │
│ API     │ │ API     │  │ FE/SDI*    │  │ (email tx)   │
└─────────┘ └─────────┘  └────────────┘  └──────────────┘
    ▲           ▲
    │ webhook   │ webhook
    │           │
┌────────────────────────┐    ┌─────────────────┐
│  Webhook receiver      │ ─▶ │  Queue          │
│  (signature verify,    │    │  (BullMQ/Redis) │
│   dedup, raw body)     │    └─────────────────┘
└────────────────────────┘
```
*FE/SDI = Fatturazione Elettronica via provider (FattureInCloud, Aruba, etc.)

### 6.2 Componenti

| Componente | Tecnologia consigliata | Motivazione |
|---|---|---|
| Storefront frontend | Next.js 15 (App Router) | SEO, performance, Vercel-friendly |
| Backend e-commerce | Medusa.js | Headless, modulare, Postgres-native |
| Database | Postgres (Neon o RDS) | Standard, transazionale, JSON-friendly |
| Cache/sessioni | Redis (Upstash) | Cart sessions, rate limit, queue |
| Job queue | BullMQ su Redis | Webhook processing async, email, SDI |
| File storage | S3 / Cloudflare R2 | Fatture PDF, immagini prodotto |
| Email transazionali | **Resend** | Già scelto (vedi demo email in questo repo) |
| Monitoring | Sentry + Better Stack | Errori + uptime + log search |
| Hosting | Vercel (frontend) + Railway/Fly.io (backend) | Auto-deploy, scaling, costi sotto controllo per il volume previsto |

### 6.3 Schema DB minimo

```sql
customers (id, email, name, phone, created_at, ...)
orders (id, customer_id, status, total_cents, currency, created_at, updated_at, ...)
  -- status: pending | processing | paid | fulfilled | shipped | refunded | cancelled
order_items (id, order_id, product_id, sku, name, qty, unit_price_cents)
payments (id, order_id, provider, provider_ref, amount_cents, status, idempotency_key, ...)
webhook_events (id, provider, event_id UNIQUE, type, payload_jsonb, processed_at)
invoices (id, order_id, type, number, pdf_url, sdi_status, sdi_ref, ...)
shipments (id, order_id, carrier, tracking_number, status, ...)
addresses (id, customer_id, type, street, city, zip, country, ...)
```

**Indici critici:** `orders.customer_id`, `orders.status`, `payments.provider_ref`, `webhook_events.event_id` (per dedup).

---

## 7. Compliance

### 7.1 SCA / PSD2

Strong Customer Authentication obbligatoria dal 2021 per pagamenti elettronici UE. Implementazione gestita automaticamente da Stripe e PayPal:
- 3DS2 challenge attivato su importi >€30 o pattern di rischio
- Esenzioni TRA (Transaction Risk Analysis) calcolate dal provider
- **Nessun codice custom richiesto** — basta usare le API attuali (vecchie Charges API NON sono SCA-compliant)

### 7.2 GDPR

- Privacy policy + Cookie banner conforme al Provvedimento Garante 2021 (no scroll-as-consent)
- Registro trattamenti (art. 30) — obbligatorio anche per piccole aziende su trattamenti su larga scala
- DPA (Data Processing Agreement) con Stripe e PayPal — fornito dai provider, da archiviare
- Trasferimento dati extra-UE (Stripe USA): **Standard Contractual Clauses** già nei DPA
- Diritto cancellazione: complicato per dati fiscali (10 anni di conservazione obbligatoria) — la pseudonimizzazione è il pattern consigliato

**Tool raccomandati:** Iubenda o Cookiebot per banner cookie + privacy policy generata; OneTrust per gestione consensi più strutturata.

### 7.3 Fatturazione elettronica IT (FatturaPA / SDI) — sezione critica

**Regole per e-commerce B2C in Italia:**

| Tipo cliente | Obbligo |
|---|---|
| **Privato italiano senza P.IVA** (caso tipico B2C) | **NO fattura elettronica obbligatoria.** Obbligatorio invio **corrispettivi telematici** giornalieri all'Agenzia delle Entrate. |
| Privato che richiede fattura | Fattura elettronica via SDI |
| Cliente con P.IVA italiana | Fattura elettronica via SDI |
| Cliente extra-UE | Fattura cartacea o documento di vendita |

**Errore comune da evitare:** molti dev integrano la fattura elettronica anche per B2C dove non serve, sostenendo costi inutili. Per la maggioranza dei nostri ordini servono **solo i corrispettivi telematici**, non la FE.

**Come implementare i corrispettivi telematici per e-commerce online:**
- L'opzione "vendita a distanza" prevede invio dati corrispettivi all'AdE entro il giorno successivo
- Si fa via provider che offre API (i punti vendita usano i Registratori Telematici fisici — RT — ma per l'online serve la procedura "Documento Commerciale Online" sul portale Fatture e Corrispettivi, o un provider terzo che lo automatizzi)

**Provider consigliati per FE + corrispettivi telematici (con API REST):**

| Provider | Pro | Contro |
|---|---|---|
| **FattureInCloud** | API REST moderna, prezzo competitivo (~€10-30/mese), UI per il commercialista | Limiti di volume nei piani base |
| **Fatture24** | Solido, integrato con conservazione | UI/API meno curate |
| **Aruba SDI** | Affidabile, ecosistema completo | API meno developer-friendly |
| **TeamSystem** | Standard per commercialisti italiani | Costoso, enterprise-oriented |

**Sconsigliata** l'integrazione diretta con SDI: richiede accreditamento come intermediario e gestione di formati XML proprietari. Meglio appoggiarsi a un provider.

### 7.4 Conservazione documenti

- **10 anni obbligatori** per documenti fiscali (DPR 633/72, art. 22)
- **Conservazione sostitutiva digitale** secondo norme AgID — richiede provider accreditato
- Provider tipici: Aruba Conservazione, InfoCert, Postecom, Wolters Kluwer
- Costo indicativo: €0.10-0.30 per documento conservato + canone annuale
- Da contrattualizzare **dal day 1** — retro-fittarlo costa molto di più

### 7.5 IVA

- 22% standard sulla maggior parte dei prodotti
- 10% / 4% / 5% su categorie specifiche (alimentari, libri, prima necessità)
- **OSS (One Stop Shop) non rilevante** per il caso IT-only
- Se in futuro si aprirà cross-border UE → registrazione OSS e gestione aliquote per paese

### 7.6 Cookie e consenso

- Banner conforme Provvedimento Garante 2021
- Tool consigliati: **Iubenda** (italiano, ~€30/anno) o **Cookiebot** (~€50/anno)
- Categorizzazione: necessari, preferenze, statistiche, marketing
- Audit periodico cookie effettivamente caricati (Google Analytics, Hotjar, Meta Pixel, ecc.)

### 7.7 Termini e condizioni / Codice del Consumo

- **Diritto di recesso 14 giorni** dall'arrivo del prodotto (DLgs 206/2005)
- Info pre-contrattuali obbligatorie (caratteristiche prodotto, prezzo totale, costi spedizione, tempi consegna, modalità recesso)
- Procedura di reso documentata (chi paga la spedizione di ritorno è scelta commerciale — non normativa)
- Modulo recesso standard scaricabile dal sito
- Garanzia legale di conformità 24 mesi
- Foro competente: residenza consumatore (non si può derogare a sfavore del consumatore)

---

## 8. Costi

### 8.1 Commissioni transazionali — esempio su €100 di ordine medio

| Provider | Commissione | Note |
|---|---|---|
| Stripe (carta UE consumer) | €1.75 (1.5% + €0.25) | Caso più frequente |
| Stripe (carta UE premium/Amex) | €2.75 (2.5% + €0.25) | |
| PayPal standard | €3.75 (3.4% + €0.35) | |
| PayPal con sconto volume | €2.05-3.20 | Solo sopra €2.500/mese |
| Satispay | ~€1.20-2.00 | Pricing trattabile |
| Nexi/XPay | ~€2.00-3.00 | Variabile per contratto |

**Costo blended atteso** (assumendo 50% carte + 40% PayPal + 10% altri): ~**€2.50 ogni €100** di transato (≈2.5%).

### 8.2 Costi nascosti

| Voce | Costo | Note |
|---|---|---|
| Chargeback Stripe | €15 cad. | Disputa persa = anche perdita merce + €15 |
| Chargeback PayPal | €20 cad. | Idem |
| Currency conversion | +2% | Solo se vendite in altra valuta |
| Refund | Commissione transazione non rimborsata | Stripe rimborsa la fee, PayPal no |
| FE provider | €0.10-0.50 per fattura | + canone €10-30/mese |
| Conservazione digitale | €0.10-0.30 per documento | + canone annuale |
| PCI compliance audit | €1-5k/anno | Solo se SAQ D — evitabile con Elements/Checkout |

### 8.3 Costi infrastruttura (stima mensile per volume basso/medio)

| Voce | Costo stimato |
|---|---|
| Hosting frontend (Vercel Pro) | $20-40 |
| Hosting backend (Railway/Fly) | $20-60 |
| Postgres (Neon Pro) | $20-50 |
| Redis (Upstash) | $0-20 |
| File storage (R2/S3) | $5-15 |
| CDN/edge (Vercel/CF incluso) | — |
| Sentry monitoring | $26 |
| Resend email | $0-20 (free tier per <3k email/mese) |
| FattureInCloud API | $15-30 |
| Conservazione digitale | $10-30 |
| Domain + SSL | $10/anno |
| **Totale mensile** | **~€140-330/mese** |

---

## 9. Sicurezza

### 9.1 PCI-DSS scope

| Approccio | SAQ | Complessità audit |
|---|---|---|
| Stripe Checkout (hosted) | **SAQ A** | Minima |
| Stripe Elements (embedded, tokenizzato) | **SAQ A** | Minima |
| Custom form con campi carta diretti | SAQ A-EP / D | Molto alta |

**Raccomandazione**: **Stripe Elements in produzione**. Mai accettare PAN (numero carta) sui nostri server. Stripe Elements rende il form integrato nell'UX del sito MA tokenizza la carta in iframe Stripe → SAQ A.

### 9.2 Gestione chiavi e segreti

- **Mai chiavi nel repo** (mai, neanche per scherzo)
- Secrets manager: Doppler, Vault, AWS Secrets Manager, 1Password Secrets Automation
- Chiavi separate per ambiente: `dev / staging / prod` (mai una chiave usata in più ambienti)
- Rotazione semestrale delle chiavi API (procedura documentata)
- Chiave **secret** Stripe MAI esposta client-side (solo la **publishable** può andare nel browser)

### 9.3 Idempotenza

- `Idempotency-Key` header su tutte le mutazioni Stripe (Stripe lo supporta nativamente — key duplicata = ritorna stessa risposta)
- Idempotency lato cliente generata con UUID v4 e memorizzata in sessionStorage per il singolo flusso checkout

### 9.4 Webhook signature verification

- **Stripe**: HMAC SHA-256 via `stripe.webhooks.constructEvent` — verifica header `Stripe-Signature` con `STRIPE_WEBHOOK_SECRET`. **Richiede raw body**.
- **PayPal**: chiamata `POST /v1/notifications/verify-webhook-signature` con tutti gli header originali
- Tolleranza timestamp 5 minuti (protezione contro replay attack)
- Idempotenza webhook: dedup su `event.id` (Stripe può inviare lo stesso evento più volte)

### 9.5 Altri controlli

- Rate limiting su endpoint sensibili (`/api/checkout/*`, `/api/auth/*`) — 100 req/min per IP
- CSP (Content Security Policy) restrittiva — script Stripe/PayPal in whitelist esplicita
- SRI (Subresource Integrity) su script CDN dove possibile
- HTTPS obbligatorio (HSTS preload)
- Log audit immutabile su mutazioni ordine (chi ha fatto refund, quando, perché)
- Backup DB cifrati, RPO 24h, RTO 4h (sufficiente per volume B2C medio)

---

## 10. Roadmap implementazione

Phasing realistico per team di 1-2 sviluppatori full-time.

### Fase 0 — Discovery (1-2 settimane)
- Risposte alle 12 domande aperte (§11)
- Decisione finale stack (Shopify vs Medusa)
- Setup account Stripe / PayPal / DNS / hosting
- Definizione brand kit minimo (logo, palette, font)

### Fase 1 — Foundations (2-3 settimane)
- Setup repo + CI/CD + ambienti (dev/staging/prod)
- Schema DB + auth utenti
- Catalogo base (prodotti, varianti, categorie)
- Admin minimo per CRUD prodotti

### Fase 2 — Checkout MVP (3-4 settimane)
- Carrello + sessioni
- Integrazione Stripe Elements + PayPal SDK
- Webhook receiver (signature verify, dedup, queue)
- Email transazionali (Resend): conferma ordine, conferma pagamento
- Test end-to-end con carte di test e PayPal sandbox

### Fase 3 — Backoffice ordini (2 settimane)
- Vista lista ordini con filtri
- Dettaglio ordine + audit log
- Refund (totale/parziale) da UI
- Cambio stato manuale (es. spedito)

### Fase 4 — Fatturazione + conservazione (2 settimane)
- Integrazione provider FE (FattureInCloud o equivalente)
- Generazione corrispettivi telematici automatica per ogni ordine paid
- Generazione FE su richiesta cliente (cliente fornisce CF/P.IVA)
- Conservazione sostitutiva (provider AgID)

### Fase 5 — Spedizioni (1-2 settimane)
- Integrazione corriere principale (API per generare LDV)
- Tracking numbers in email automatiche
- Pagina "I miei ordini" con stato spedizione

### Fase 6 — Hardening + go-live (2 settimane)
- Penetration test (PCI obbligatorio se SAQ A-EP, raccomandato comunque)
- Load test su scenari di picco
- Setup monitoring/alerting (Sentry + Better Stack)
- Runbook operativo (chi fa cosa in caso di outage, chargeback massivo, fraud detection)
- Pre-launch: verifica DNS, SSL, cookie banner, T&C, privacy policy
- Soft launch su gruppo limitato → full launch

**Totale: 13-17 settimane (3-4 mesi)** per MVP production-ready.

---

## 11. Domande aperte per il cliente

| # | Domanda | Impatto della risposta |
|---|---|---|
| 1 | **Volume atteso anno 1**: ordini/mese, AOV (valore medio ordine)? | Sceglie stack (Shopify se basso, custom se alto), tier provider |
| 2 | **Account Stripe Terminal esistente**: stessa ragione sociale del nuovo e-commerce? | Blocca decisione "stesso account" vs "nuovo account" |
| 3 | **Catalogo**: quanti SKU? Varianti (taglia/colore)? Gestionale/ERP esistente per il magazzino? | Determina sforzo integrazione e modello dati |
| 4 | **Spedizioni**: corriere preferito (BRT, GLS, Poste, DHL)? Accordi commerciali già attivi? | Sceglie SDK/API corriere da integrare |
| 5 | **Software fatturazione**: il commercialista usa già qualcosa (FattureInCloud, TeamSystem, Aruba)? | Sceglie provider FE/conservazione da integrare |
| 6 | **Backoffice ordini**: deve integrarsi con un gestionale esistente? Quale? | Sforzo integrazione, scelta middleware |
| 7 | **Diritto di recesso**: chi paga la spedizione di ritorno (azienda o cliente)? | Scelta commerciale + impatto su conversion |
| 8 | **Brand**: logo, palette colori, linee guida già esistenti? | Effort design |
| 9 | **CRM/mailing**: usano già qualcosa (Mailchimp, Klaviyo, HubSpot, Brevo)? | Integrazione per email marketing post-acquisto |
| 10 | **Marketplace presence**: vendono già su Amazon, eBay? Serve sync prodotti/ordini? | Aggiunge complessità multicanale |
| 11 | **Programmi fedeltà / sconti / codici promozionali**: quali meccaniche servono? | Effort backend, scelta plugin/build |
| 12 | **Multi-lingua futuro o IT only stabile**? | Scelta architettura i18n da subito o no |

---

## 12. Rischi e mitigazioni

| Rischio | Probabilità | Impatto | Mitigazione |
|---|---|---|---|
| PayPal sandbox instabile in dev | Alta | Basso | Buffer tempo in Fase 2, account sandbox multipli |
| Cambio normativa fatturazione elettronica | Media | Medio | Provider esterno assorbe gli aggiornamenti |
| Stripe Radar false positive su utenti italiani | Media | Medio | Tuning regole post-launch, whitelist progressiva |
| Vendor lock-in Stripe | Bassa | Alto | Astrazione layer payment nel codice (interfaccia `PaymentProvider`) |
| Webhook delivery delay >5s | Media | Basso | UX success page con polling + stato intermedio `processing` |
| Chargeback spike post-launch | Bassa | Medio | Radar attivo, threshold alert in Better Stack, procedura dispute documentata |
| Picchi traffico imprevisti (es. campagne marketing) | Media | Medio | Auto-scaling hosting + queue async per webhook + Redis per cart sessions |
| Bug compliance scoperto in audit fiscale | Bassa | Alto | Setup conservazione + corrispettivi telematici dal day 1, non retro-fit |

---

## 13. Appendice

### 13.1 Link documentazione ufficiale

- Stripe IT pricing: [stripe.com/it/pricing](https://stripe.com/it/pricing)
- Stripe testing (test cards aggiornate): [stripe.com/docs/testing](https://stripe.com/docs/testing)
- Stripe Italia (compliance, SCA): [stripe.com/it/guides](https://stripe.com/it/guides)
- PayPal Developer: [developer.paypal.com](https://developer.paypal.com)
- PayPal IT pricing: [paypal.com/it/business/fees](https://www.paypal.com/it/webapps/mpp/merchant-fees)
- Agenzia delle Entrate — corrispettivi telematici: [agenziaentrate.gov.it](https://www.agenziaentrate.gov.it)
- AgID conservazione: [agid.gov.it](https://www.agid.gov.it/it/piattaforme/conservazione)
- Garante Privacy — cookie 2021: [garanteprivacy.it](https://www.garanteprivacy.it)
- Codice del Consumo (DLgs 206/2005): [normattiva.it](https://www.normattiva.it)

### 13.2 Glossario

| Termine | Significato |
|---|---|
| SCA | Strong Customer Authentication (autenticazione forte, PSD2) |
| 3DS / 3DS2 | 3-D Secure / 3-D Secure 2 — protocollo autenticazione carte |
| SDI | Sistema di Interscambio (canale fatturazione elettronica AdE) |
| FE | Fattura Elettronica |
| FatturaPA | Formato XML fatture elettroniche italiane |
| PSP | Payment Service Provider |
| PSD2 | Payment Services Directive 2 (direttiva UE pagamenti) |
| SAQ | Self-Assessment Questionnaire (PCI-DSS) |
| PAN | Primary Account Number (numero carta) |
| KYC | Know Your Customer (verifica identità) |
| AOV | Average Order Value (valore medio ordine) |
| MRR/ARR | Monthly/Annual Recurring Revenue |
| OSS | One Stop Shop (regime IVA UE per cross-border B2C) |
| AdE | Agenzia delle Entrate |
| RT | Registratore Telematico (POS fiscali) |
| LDV | Lettera di Vettura (spedizione) |

### 13.3 Carte di test Stripe (verifica sempre [stripe.com/docs/testing](https://stripe.com/docs/testing))

| Numero | Scenario |
|---|---|
| 4242 4242 4242 4242 | Visa happy path |
| 5555 5555 5555 4444 | Mastercard happy path |
| 3782 822463 10005 | American Express happy path |
| 4000 0027 6000 3184 | Carta che richiede 3DS challenge |
| 4000 0025 0000 3155 | 3DS richiesto e fallisce |
| 4000 0000 0000 9995 | Insufficient funds (declined) |
| 4000 0000 0000 0002 | Generic decline |
| 4100 0000 0000 0019 | Fraudolent (bloccata da Radar) |

Scadenza: qualsiasi data futura. CVC: qualsiasi 3 cifre. CAP: qualsiasi.

---

**Prossimi passi suggeriti:**
1. Call con il cliente per chiudere le 12 domande aperte (§11)
2. Decisione finale stack (Shopify vs Medusa) sulla base dei volumi
3. Demo live sandbox (in questo repo) per validare il flusso con il cliente
4. Preventivo finale e contratto
5. Kickoff Fase 0

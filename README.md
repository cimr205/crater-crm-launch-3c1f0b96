# Crater CRM — Platform Oversigt

Crater CRM er en multi-tenant B2B CRM-platform til danske bureauer. Den håndterer leads, deals, medarbejdere, e-mailkampagner, Meta Ads og AI-drevne workflows. Hver virksomhed (tenant) får sit eget isolerede workspace. UI er fuldt oversat til **dansk (DA)**, **engelsk (EN)** og **tysk (DE)**.

---

## Tech Stack

| Lag | Teknologi |
|-----|-----------|
| Frontend | React 18 + TypeScript + Vite |
| UI-komponenter | shadcn/ui (Radix UI primitives) |
| Styling | Tailwind CSS med CSS-variabler |
| State / data | TanStack React Query v5 |
| Auth + OAuth | Supabase Auth (Google OAuth) |
| Primær API | Custom REST API (`https://api.aiagencydanmark.dk/api`) |
| i18n | Custom `useI18n()` hook — oversættelser i `src/messages/` |
| Routing | React Router DOM v6 med locale-prefix (`/:locale/app/...`) |

---

## Kom i gang

```bash
npm install
npm run dev        # Starter dev-server på :8080
npm run build      # Produktionsbuild
npm run type-check # TypeScript-tjek
npm run lint       # ESLint-tjek
npm run check      # type-check + lint samlet
npm test           # Kør Vitest-tests
```

### Miljøvariabler

```env
VITE_SUPABASE_URL=              # Supabase projekt-URL
VITE_SUPABASE_PUBLISHABLE_KEY=  # Supabase anon/public key
VITE_API_BASE_URL=              # Valgfri: overstyr Railway API base
```

---

## Roller & Adgangsniveauer

| Rolle | Adgang |
|-------|--------|
| `employee` | Basis adgang til egne data |
| `manager` | Team-ledelse og rapporter |
| `admin` | Fuld virksomhedsadgang |
| `global_admin` | Systemdækkende superbruger (admin-panel) |

---

## Moduler & Features

### 🔐 Auth — Login & Adgang

| Side | Beskrivelse |
|------|-------------|
| Login | Email + adgangskode eller Google OAuth |
| Signup | Opret ny konto |
| RegisterCompany | Fuld firmaregistrering med CVR, plan og betalingsstatus |
| JoinCompany | Medarbejder tilslutter sig virksomhed med inviteringskode |
| ForgotPassword | Sender nulstillingsmail |
| ResetPassword | Sætter ny adgangskode |

---

### 📊 Dashboard

Realtidsoverblik med:
- Pipeline-værdi og konverteringsrate
- Antal nye leads og aktive deals
- Åbne opgaver og omsætningsprognose
- Animerede tælletals-widgets og personlig velkomsthilsen

---

### 📋 CRM — Kunderelationer

| Side | Beskrivelse |
|------|-------------|
| **Leads** | Fuld CRUD — søg og filtrer på status/kilde, opret/rediger/slet, automatisk CVR-opslag, lead-score |
| **Deals** | Kanban pipeline med 5 stages (Nyt → Kontaktet → Møde → Tilbud → Forhandling), drag-and-drop og deal-værdi |
| **Kunder** | Oversigt over eksisterende kunder |
| **Kampagner** | Samlet kampagneoversigt |

**Lead-statuser:** `cold` · `contacted` · `qualified` · `customer` · `lost`

---

### 💰 Finans

| Side | Beskrivelse |
|------|-------------|
| **Fakturaer** | Opret og send fakturaer med linjepostposter, multi-valuta (DKK/EUR/USD/GBP/SEK/NOK), dansk moms 25%, EU reverse charge, internationale kunder uden moms |
| **Betalinger** | Betalingsoversigt og statussporing |

---

### 👥 HR — Personale

| Side | Beskrivelse |
|------|-------------|
| **Medarbejdere** | Teamoversigt, rolleskift, invite nye medarbejdere |
| **Fremmøde** | Check-in/check-out tidssporing |
| **Ferie** | Ferieansøgninger og lederens godkendelsesflow |
| **Løn** | Lønadministration og udbetalingsoversigt |
| **Rekruttering** | Ansættelsesflow fra ansøgning til ansættelse |

---

### ✅ Produktivitet

| Side | Beskrivelse |
|------|-------------|
| **AI Opgaver** | AI scanner e-mails og foreslår opgaver automatisk — godkendelsesflow og Vikunja-sync |
| **Kalender** | Kalender og begivenhedsplanlægning |
| **To-dos** | Simpel opgaveliste via Donetick-integration |

---

### 📬 Kommunikation

| Side | Beskrivelse |
|------|-------------|
| **Indbakke** | Gmail/EmailEngine integration — AI prioriterer e-mails (møder, deadlines, fakturaer, kontrakter) — opret opgaver direkte fra mails |
| **E-mails** | Generel e-mailoversigt |
| **Email Kampagner** | ListMonk integration — opret og planlæg kampagner, spor åbningsrate og svar |
| **Masseudsendelse** | Send bulk e-mails til store modtagerlister |
| **Meta Ads** | Facebook/Instagram kampagner — budget, forbrug, impressions, CTR, CPC, leads, ROAS |

---

### 🤖 AI & Automation

| Side | Beskrivelse |
|------|-------------|
| **ClowdBot** | AI-drevet lead-scraping via 6 datakilder: Apollo, Google Places, HubSpot, Salesforce, Hunter.io, Clearbit — job-baseret med planlægning |
| **Workflows** | No-code automatisering med 9 trigger-typer (nyt lead, statusskift, faktura forfaldent, opgave afsluttet m.fl.) og 5+ handlinger (send mail, opret opgave, opdater lead osv.) |
| **AI Media** | Generer billeder og videoer med AI — vælg stil (realistisk, illustreret, cinematisk) og billedformat (1:1, 16:9) |

---

### ⚙️ System

| Side | Beskrivelse |
|------|-------------|
| **Historik** | Aktivitets- og hændelseslog for hele virksomheden |
| **Integrationer** | Konfigurer tredjeparts-services: EmailEngine, ListMonk, Vikunja, Donetick, AI-e-mailklassificering — OAuth og API-nøgler |
| **Virksomhedsindstillinger** | Navn, CVR, adresse, abonnementsplan, inviteringskode og firmalogo |

---

### 🔐 Admin-panel *(kun global_admin)*

| Side | Beskrivelse |
|------|-------------|
| **Overblik** | Alle virksomheder, aktiver/deaktiver tenants, brugere pr. virksomhed |
| **Brugere** | Systemdækkende brugeroversigt og administration |
| **Virksomheder** | Administrer alle tenants på tværs af platformen |
| **Medarbejdere** | Global medarbejderoversigt |
| **AI-forbrug** | Spor AI-forbrug og kvoter pr. virksomhed |
| **Systemindstillinger** | Globale platformsindstillinger |

---

## Arkitektur

```
Frontend (React/Vite)
        │
        ▼
Railway REST API  ←── JWT auth via Supabase
        │
        ▼
Supabase DB (companies, profiles, leads, invitations, user_roles)
```

- Frontend kalder **kun** backend-API'et
- Backend håndterer hele auth/token-flowet via Supabase
- Multi-tenant isolation via `company_id`, backend RBAC og Supabase RLS
- Google OAuth: `supabase.auth.signInWithOAuth()` → `/auth/callback` → `api.exchangeGoogleSession()`

---

## Repo-regler

- `.env`-filer ignoreres og må **aldrig** committes
- Pre-commit hooks (Husky) kører lint-staged automatisk ved hvert commit
- CI kører: `type-check` → `lint` → `build` ved hvert push

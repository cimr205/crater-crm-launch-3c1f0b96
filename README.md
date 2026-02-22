# CRM + HR Platform

This repository contains two systems in a single codebase:

1) **CRM Platform (Lovable frontend + Railway backend + Supabase auth/db)**
2) **HRMS Platform (Django)**

---

## CRM Platform (Rebuilt Auth + Multi-Tenant)

### Frontend (Vite + React / Lovable)
- Source: `src/`
- Run:
  ```bash
  npm install
  npm run dev
  ```

### Backend (Node + TypeScript / Railway)
- Source: `server/`
- Run:
  ```bash
  cd server
  npm install
  npm run dev
  ```

### Supabase migration
- SQL migration: `supabase/migrations/20260222070000_multi_tenant_rebuild.sql`

### Architecture
- Frontend calls backend only
- Backend handles all auth/token flow via Supabase
- Backend validates Supabase JWT on every protected request
- Multi-tenant isolation via:
  - `company_id`
  - backend RBAC
  - Supabase RLS policies

Detailed setup guide:
- `docs/SUPABASE_RAILWAY_REBUILD.md`

---

## HRMS Platform (Django)

The HR system lives in the `hr/` directory.  
Main entrypoint: `hr/manage.py`

### Run locally
```bash
cd hr
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\\Scripts\\activate
pip install -r requirements.txt
cp .env.dist .env
python manage.py migrate
python manage.py runserver
```

---

## Repo Rules
- `.env` files are ignored and must never be committed.
- CRM and HR systems run independently for now.


-- =========================================================
-- Onboarding gate: nullable company_id + onboarding_completed
-- =========================================================

-- Allow users to exist before they join/create a company
ALTER TABLE public.users
  ALTER COLUMN company_id DROP NOT NULL;

-- Track whether the user has completed onboarding
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS onboarding_completed boolean NOT NULL DEFAULT false;

-- Enrich company with data collected during onboarding wizard
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS industry text,
  ADD COLUMN IF NOT EXISTS size text,
  ADD COLUMN IF NOT EXISTS goal text;

-- Existing fully-onboarded users are already completed
UPDATE public.users
  SET onboarding_completed = true
  WHERE company_id IS NOT NULL;

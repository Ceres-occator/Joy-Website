-- Move minimum deposit configuration to per-villa level on public.villas
ALTER TABLE public.villas
  ADD COLUMN IF NOT EXISTS min_deposit_percent numeric(5,2) NOT NULL DEFAULT 50.00
  CHECK (min_deposit_percent >= 0 AND min_deposit_percent <= 100);

COMMENT ON COLUMN public.villas.min_deposit_percent IS 'Minimum deposit percentage required when booking this specific villa (default 50%).';


BEGIN;

ALTER TABLE public.dcs_transaction_items
ALTER COLUMN code TYPE VARCHAR(255);

COMMIT;
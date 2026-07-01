-- KYC verification flag for payouts. Previously ensured at runtime by the payouts
-- handler (schema drift); now owned by migrations.
ALTER TABLE users ADD COLUMN IF NOT EXISTS kyc_verified BOOLEAN NOT NULL DEFAULT FALSE;

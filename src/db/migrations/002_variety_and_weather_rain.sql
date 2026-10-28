-- Run SHOW timezone; first. This assumes it returns UTC.

BEGIN;

-- 1. Add variety and grade columns to price_records
ALTER TABLE price_records
    ADD COLUMN variety VARCHAR(100) NOT NULL DEFAULT 'Unknown',
    ADD COLUMN grade VARCHAR(50);

-- 2. Drop the existing unique constraint on price_records dynamically
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT conname
        FROM pg_constraint
        WHERE conrelid = 'price_records'::regclass
          AND contype = 'u'
    ) LOOP
        EXECUTE 'ALTER TABLE price_records DROP CONSTRAINT ' || quote_ident(r.conname);
    END LOOP;
END $$;

-- 3. Add new unique constraint including variety
ALTER TABLE price_records
    ADD CONSTRAINT price_records_unique_day_variety UNIQUE (crop_id, market_id, record_date, variety);

-- 4. Truncate price_records (existing rows are averages and will be re-synced)
TRUNCATE price_records RESTART IDENTITY;

-- 5. Add rain_mm column to weather_records
ALTER TABLE weather_records
    ADD COLUMN rain_mm DECIMAL(6,1) NOT NULL DEFAULT 0;

-- 6. Convert timestamps to TIMESTAMPTZ
ALTER TABLE weather_records
    ALTER COLUMN fetched_at TYPE TIMESTAMPTZ USING fetched_at AT TIME ZONE 'UTC';

ALTER TABLE price_records
    ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';

COMMIT;

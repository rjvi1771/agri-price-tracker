import { pool } from "../db/pool";
import { fetchMandiPrices } from "../services/mandiApiClient";

export async function syncPricesForMarket(cropName: string, district: string, state: string) {
    console.log(`[syncPrices] Fetching ${cropName} prices for ${district}, ${state}...`);

    const cropResult = await pool.query("SELECT id FROM crops WHERE name = $1", [cropName]);
    const marketResult = await pool.query(
        "SELECT id FROM markets WHERE district = $1 AND state = $2",
        [district, state]
    );

    if (cropResult.rows.length === 0 || marketResult.rows.length === 0) {
        throw new Error(
            `Crop "${cropName}" or market "${district}, ${state}" not found. Seed them first (see 001_init.sql).`
        );
    }

    const cropId = cropResult.rows[0].id;
    const marketId = marketResult.rows[0].id;

    const records = await fetchMandiPrices({ state, district, commodity: cropName });

    if (records.length === 0) {
        console.log(`[syncPrices] No records returned for ${cropName} in ${district} today.`);
        return { inserted: 0 };
    }

    let inserted = 0;
    for (const record of records) {
        await pool.query(
            `INSERT INTO price_records (crop_id, market_id, record_date, min_price, max_price, modal_price)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (crop_id, market_id, record_date)
       DO UPDATE SET min_price = EXCLUDED.min_price,
                     max_price = EXCLUDED.max_price,
                     modal_price = EXCLUDED.modal_price`,
            [cropId, marketId, record.arrival_date, record.min_price, record.max_price, record.modal_price]
        );
        inserted++;
    }

    console.log(`[syncPrices] Upserted ${inserted} record(s) for ${cropName} in ${district}.`);
    return { inserted };
}

if (require.main === module) {
    syncPricesForMarket("Onion", "Bengaluru", "Karnataka")
        .then(async () => {
            await pool.end();
            process.exit(0);
        })
        .catch(async (err) => {
            console.error("[syncPrices] Failed:", err);
            await pool.end();
            process.exit(1);
        });
}
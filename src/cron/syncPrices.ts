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

    let skipped = 0;
    const validRecords = [];
    for (const record of records) {
        // Sanity filter: ignore corrupt numbers and extreme entry typos
        const isPlausible =
            record.min_price > 0 &&
            record.max_price > 0 &&
            record.modal_price > 0 &&
            record.min_price <= record.max_price &&
            record.modal_price >= record.min_price &&
            record.modal_price <= record.max_price &&
            record.max_price <= record.modal_price * 4;

        if (!isPlausible) {
            skipped++;
            console.warn(
                `[syncPrices] Skipped outlier/invalid record for ${cropName} in ${district} (${record.arrival_date}): min=${record.min_price}, modal=${record.modal_price}, max=${record.max_price}`
            );
            continue;
        }
        validRecords.push(record);
    }

    // Group by arrival_date and aggregate to one row per date
    const byDate = new Map<string, { minSum: number; maxSum: number; modalSum: number; count: number }>();
    for (const r of validRecords) {
        const entry = byDate.get(r.arrival_date) ?? { minSum: 0, maxSum: 0, modalSum: 0, count: 0 };
        entry.minSum += r.min_price;
        entry.maxSum += r.max_price;
        entry.modalSum += r.modal_price;
        entry.count += 1;
        byDate.set(r.arrival_date, entry);
    }

    let inserted = 0;
    for (const [arrival_date, stats] of byDate.entries()) {
        const avgMin = Math.round((stats.minSum / stats.count) * 100) / 100;
        const avgMax = Math.round((stats.maxSum / stats.count) * 100) / 100;
        const avgModal = Math.round((stats.modalSum / stats.count) * 100) / 100;

        await pool.query(
            `INSERT INTO price_records (crop_id, market_id, record_date, min_price, max_price, modal_price)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (crop_id, market_id, record_date)
       DO UPDATE SET min_price = EXCLUDED.min_price,
                     max_price = EXCLUDED.max_price,
                     modal_price = EXCLUDED.modal_price`,
            [cropId, marketId, arrival_date, avgMin, avgMax, avgModal]
        );
        inserted++;
    }

    console.log(
        `[syncPrices] Upserted ${inserted} record(s) for ${cropName} in ${district}${skipped > 0 ? ` (${skipped} outlier/invalid skipped)` : ""}.`
    );
    return { inserted, skipped };
}

export async function syncAllPrices() {
    console.log("[syncPrices] Syncing prices for all registered crops and markets...");
    const crops = await pool.query("SELECT name FROM crops ORDER BY name");
    const markets = await pool.query("SELECT district, state FROM markets ORDER BY district");

    let totalInserted = 0;
    let failures = 0;
    for (const crop of crops.rows) {
        for (const market of markets.rows) {
            try {
                const res = await syncPricesForMarket(crop.name, market.district, market.state);
                totalInserted += res.inserted;
            } catch (err) {
                failures++;
                console.error(`[syncPrices] Failed for ${crop.name} in ${market.district}:`, err);
            }
        }
    }

    console.log(
        `[syncPrices] Finished syncing prices. Total records upserted: ${totalInserted}, Failures: ${failures}`
    );
    return { totalInserted, failures };
}

if (require.main === module) {
    syncAllPrices()
        .then(async ({ failures }) => {
            await pool.end();
            process.exit(failures > 0 ? 1 : 0);
        })
        .catch(async (err) => {
            console.error("[syncPrices] Failed:", err);
            await pool.end();
            process.exit(1);
        });
}
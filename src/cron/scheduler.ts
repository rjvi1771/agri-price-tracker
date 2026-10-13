import cron from "node-cron";
import { pool } from "../db/pool";
import { syncPricesForMarket } from "./syncPrices";
import { syncAllMarketsWeather } from "./syncWeather";

async function runPriceSync() {
    const crops = await pool.query("SELECT name FROM crops");
    const markets = await pool.query("SELECT district, state FROM markets");

    for (const crop of crops.rows) {
        for (const market of markets.rows) {
            try {
                await syncPricesForMarket(crop.name, market.district, market.state);
            } catch (err) {
                console.error(`[scheduler] Price sync failed for ${crop.name}/${market.district}:`, err);
            }
        }
    }
}

export function startScheduler() {
    // Mandi data is published once a day: 7:00 AM IST.
    cron.schedule("0 7 * * *", runPriceSync, { timezone: "Asia/Kolkata" });

    // Forecasts change faster: every 6 hours.
    cron.schedule(
        "0 */6 * * *",
        () => {
            syncAllMarketsWeather().catch((err: unknown) =>
                console.error("[scheduler] Weather sync failed:", err)
            );
        },
        { timezone: "Asia/Kolkata" }
    );

    console.log("[scheduler] Jobs registered (prices daily 07:00 IST, weather every 6h)");
}
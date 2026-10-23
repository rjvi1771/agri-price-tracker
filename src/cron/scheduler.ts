import cron from "node-cron";
import { syncAllPrices } from "./syncPrices";
import { syncAllMarketsWeather } from "./syncWeather";

export function startScheduler() {
    // Mandi data is published once a day: 7:00 AM IST.
    cron.schedule(
        "0 7 * * *",
        () => {
            syncAllPrices().catch((err: unknown) =>
                console.error("[scheduler] Price sync failed:", err)
            );
        },
        { timezone: "Asia/Kolkata" }
    );

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
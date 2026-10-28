import { pool } from "../db/pool";
import { fetchWeatherForecast } from "../services/weatherClient";

export async function syncWeatherForMarket(marketId: number, lat: number, lon: number) {
    console.log(`[syncWeather] Fetching forecast for market ID ${marketId} (lat: ${lat}, lon: ${lon})...`);
    const forecast = await fetchWeatherForecast(lat, lon);

    if (forecast.length === 0) {
        console.log(`[syncWeather] No forecast data received for market ID ${marketId}.`);
        return { inserted: 0 };
    }

    let inserted = 0;
    for (const day of forecast) {
        await pool.query(
            `INSERT INTO weather_records (market_id, record_date, rain_probability, condition, temp_min, temp_max, fetched_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       ON CONFLICT (market_id, record_date)
       DO UPDATE SET rain_probability = EXCLUDED.rain_probability,
                     condition = EXCLUDED.condition,
                     temp_min = EXCLUDED.temp_min,
                     temp_max = EXCLUDED.temp_max,
                     fetched_at = NOW()`,
            [marketId, day.date, day.rainProbability, day.condition, day.tempMin, day.tempMax]
        );
        inserted++;
    }

    console.log(`[syncWeather] Upserted ${inserted} weather forecast day(s) for market ID ${marketId}.`);
    return { inserted };
}

export async function syncAllMarketsWeather() {
    console.log("[syncWeather] Fetching all markets with GPS coordinates...");
    const marketsResult = await pool.query(
        "SELECT id, name, district, latitude, longitude FROM markets WHERE latitude IS NOT NULL AND longitude IS NOT NULL"
    );

    if (marketsResult.rows.length === 0) {
        console.log("[syncWeather] No markets found with latitude and longitude. Please seed markets first.");
        return { totalInserted: 0, failures: 0 };
    }

    let totalInserted = 0;
    let failures = 0;
    for (const market of marketsResult.rows) {
        console.log(`[syncWeather] Processing market: ${market.name} (${market.district})...`);
        try {
            const { inserted } = await syncWeatherForMarket(
                market.id,
                parseFloat(market.latitude),
                parseFloat(market.longitude)
            );
            totalInserted += inserted;
        } catch (err) {
            failures++;
            console.error(`[syncWeather] Error syncing weather for ${market.name}:`, err);
        }
    }

    console.log(
        `[syncWeather] Finished syncing weather. Total daily records upserted: ${totalInserted}, Failures: ${failures}`
    );
    return { totalInserted, failures };
}

if (require.main === module) {
    syncAllMarketsWeather()
        .then(async ({ failures }) => {
            await pool.end();
            process.exit(failures > 0 ? 1 : 0);
        })
        .catch(async (err) => {
            console.error("[syncWeather] Failed:", err);
            await pool.end();
            process.exit(1);
        });
}

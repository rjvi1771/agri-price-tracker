import { env } from "../config/env";

const BASE_URL = "https://api.openweathermap.org/data/2.5/forecast";

// OpenWeatherMap's free "forecast" endpoint gives 5 days of data in
// 3-hour blocks (40 entries total), not one entry per day. We'll
// collapse those down to one summary per day ourselves below — the API
// doesn't do that grouping for us.
interface ForecastEntry {
    dt: number; // Unix timestamp in seconds (UTC)
    dt_txt: string; // "2026-10-07 12:00:00"
    main: { temp_min: number; temp_max: number };
    weather: { main: string; description: string }[];
    pop: number; // "probability of precipitation", 0 to 1 — this is where rain % comes from
    rain?: { "3h"?: number };
}

interface ForecastResponse {
    list: ForecastEntry[];
}

export interface DailyWeather {
    date: string; // "YYYY-MM-DD"
    rainProbability: number; // 0-100
    rainMm: number;
    condition: string;
    tempMin: number;
    tempMax: number;
}

const IST_OFFSET_SECONDS = 19800; // 5 hours 30 minutes (IST = UTC + 5:30)

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchWithRetry(url: string): Promise<Response> {
    let response: Response | null = null;
    let shouldRetry = false;
    let reason = "";

    try {
        response = await fetch(url);
        if (response.status >= 500 && response.status < 600) {
            shouldRetry = true;
            reason = `${response.status} ${response.statusText}`;
        } else if (!response.ok) {
            throw new Error(`OpenWeatherMap request failed: ${response.status} ${response.statusText}`);
        } else {
            return response;
        }
    } catch (err: any) {
        if (response && response.status >= 400 && response.status < 500) {
            throw err;
        }
        shouldRetry = true;
        reason = err?.message || String(err);
    }

    if (shouldRetry) {
        console.warn(`[weatherClient] Request failed (${reason}). Retrying once after 5s...`);
        await sleep(5000);
        const retryRes = await fetch(url);
        if (!retryRes.ok) {
            throw new Error(`OpenWeatherMap request failed: ${retryRes.status} ${retryRes.statusText}`);
        }
        return retryRes;
    }

    return response!;
}

export async function fetchWeatherForecast(lat: number, lon: number): Promise<DailyWeather[]> {
    const url = new URL(BASE_URL);
    url.searchParams.set("lat", String(lat));
    url.searchParams.set("lon", String(lon));
    url.searchParams.set("appid", env.openWeatherApiKey);
    url.searchParams.set("units", "metric"); // Celsius, not Kelvin

    const response = await fetchWithRetry(url.toString());

    const data = (await response.json()) as ForecastResponse;

    // Group the 3-hour entries by IST calendar date, shifting UTC timestamp
    // by +5:30 (19,800 s) so evening blocks fall on their actual IST date.
    const byDate = new Map<string, ForecastEntry[]>();
    for (const entry of data.list) {
        const istDateObj = new Date((entry.dt + IST_OFFSET_SECONDS) * 1000);
        const date = istDateObj.toISOString().split("T")[0]; // "YYYY-MM-DD" in IST

        if (!byDate.has(date)) byDate.set(date, []);
        byDate.get(date)!.push(entry);
    }

    const daily: DailyWeather[] = [];
    for (const [date, entries] of byDate.entries()) {
        const maxPop = Math.max(...entries.map((e) => e.pop));
        const tempMin = Math.min(...entries.map((e) => e.main.temp_min));
        const tempMax = Math.max(...entries.map((e) => e.main.temp_max));

        // Total rain amount in mm for the day
        const totalRain = entries.reduce((sum, e) => sum + (e.rain?.["3h"] ?? 0), 0);
        const rainMm = Math.round(totalRain * 10) / 10;

        // Choose condition from the block with highest pop (tie-break: block with more rain, then the later block)
        const rainiestBlock = entries.reduce((best, current) => {
            if (current.pop > best.pop) return current;
            if (current.pop < best.pop) return best;

            const currentRain = current.rain?.["3h"] ?? 0;
            const bestRain = best.rain?.["3h"] ?? 0;
            if (currentRain > bestRain) return current;
            if (currentRain < bestRain) return best;

            return current.dt > best.dt ? current : best;
        });

        daily.push({
            date,
            rainProbability: Math.round(maxPop * 100),
            rainMm,
            condition: rainiestBlock.weather[0]?.main || "Clear",
            tempMin: Math.round(tempMin * 10) / 10,
            tempMax: Math.round(tempMax * 10) / 10,
        });
    }

    return daily;
}
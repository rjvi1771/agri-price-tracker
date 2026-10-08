import { env } from "../config/env";

const BASE_URL = "https://api.openweathermap.org/data/2.5/forecast";

// OpenWeatherMap's free "forecast" endpoint gives 5 days of data in
// 3-hour blocks (40 entries total), not one entry per day. We'll
// collapse those down to one summary per day ourselves below — the API
// doesn't do that grouping for us.
interface ForecastEntry {
    dt_txt: string; // "2026-10-07 12:00:00"
    main: { temp_min: number; temp_max: number };
    weather: { main: string; description: string }[];
    pop: number; // "probability of precipitation", 0 to 1 — this is where rain % comes from
}

interface ForecastResponse {
    list: ForecastEntry[];
}

export interface DailyWeather {
    date: string; // "YYYY-MM-DD"
    rainProbability: number; // 0-100
    condition: string;
    tempMin: number;
    tempMax: number;
}

export async function fetchWeatherForecast(lat: number, lon: number): Promise<DailyWeather[]> {
    const url = new URL(BASE_URL);
    url.searchParams.set("lat", String(lat));
    url.searchParams.set("lon", String(lon));
    url.searchParams.set("appid", env.openWeatherApiKey);
    url.searchParams.set("units", "metric"); // Celsius, not Kelvin

    const response = await fetch(url.toString());

    if (!response.ok) {
        throw new Error(`OpenWeatherMap request failed: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as ForecastResponse;

    // Group the 3-hour entries by calendar date, then collapse each
    // day's entries into one summary: max rain probability seen that
    // day (a farmer cares about the worst case, not the average), and
    // the min/max temps across all of that day's entries.
    const byDate = new Map<string, ForecastEntry[]>();
    for (const entry of data.list) {
        const date = entry.dt_txt.split(" ")[0]; // "2026-10-07 12:00:00" -> "2026-10-07"
        if (!byDate.has(date)) byDate.set(date, []);
        byDate.get(date)!.push(entry);
    }

    const daily: DailyWeather[] = [];
    for (const [date, entries] of byDate.entries()) {
        const maxPop = Math.max(...entries.map((e) => e.pop));
        const tempMin = Math.min(...entries.map((e) => e.main.temp_min));
        const tempMax = Math.max(...entries.map((e) => e.main.temp_max));
        // Use the midday entry's condition as representative of the day,
        // falling back to the first entry if midday isn't present.
        const midday = entries.find((e) => e.dt_txt.includes("12:00:00")) ?? entries[0];

        daily.push({
            date,
            rainProbability: Math.round(maxPop * 100),
            condition: midday.weather[0].main,
            tempMin: Math.round(tempMin * 10) / 10,
            tempMax: Math.round(tempMax * 10) / 10,
        });
    }

    return daily;
}
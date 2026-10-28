import dotenv from "dotenv";
dotenv.config();

function required(key: string): string {
    const value = process.env[key];
    if (!value) {
        throw new Error(`Missing required environment variable: ${key}`);
    }
    return value;
}

export const env = {
    port: process.env.PORT || "5000",
    databaseUrl: required("DATABASE_URL"),
    openWeatherApiKey: required("OPENWEATHER_API_KEY"),
    enableScheduler: process.env.ENABLE_SCHEDULER ?? "true",
    // no mandi API key needed — it's keyless
};
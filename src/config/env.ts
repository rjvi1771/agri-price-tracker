import dotenv from "dotenv";
dotenv.config();

// Centralizing env vars here means the rest of the app never touches
// process.env directly — if a var is missing, we fail fast at startup
// with a clear error, instead of a confusing crash later.
function required(key: string): string {
    const value = process.env[key];
    if (!value) {
        throw new Error(`Missing required environment variable: ${key}`);
    }
    return value;
}

export const env = {
    port: process.env.PORT || "5000",
    databaseUrl: required("postgresql://postgres.xwaqqlobrlvnknkboewu:[Vijayrj@179]@aws-0-ap-south-1.pooler.supabase.com:6543/postgres"),
    openWeatherApiKey: required("OPENWEATHER_API_KEY"),
    dataGovApiKey: required("DATA_GOV_API_KEY"),
};
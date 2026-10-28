const BASE_URL = import.meta.env.VITE_API_URL as string;

// --- Types (match the backend's SQL column names exactly) ---

export interface Crop {
    id: number;
    name: string;
    unit: string;
}

export interface Market {
    id: number;
    name: string;
    district: string;
    state: string;
}

export interface VarietyRecord {
    variety: string;
    grade: string | null;
}

export interface PriceRecord {
    record_date: string;       // "YYYY-MM-DD"
    min_price: number;
    max_price: number;
    modal_price: number;
    variety?: string;
    grade?: string | null;
    varieties_reported?: number;
}

export interface SeasonalRecord {
    month: number;             // 1–12
    avg_modal_price: number;
    data_points: number;
}

export interface WeatherRecord {
    record_date: string;
    rain_probability: number;
    rain_mm: number;
    condition: string;
    temp_min: number;
    temp_max: number;
    fetched_at: string;
}

// --- Fetch helpers ---

async function get<T>(path: string): Promise<T> {
    const res = await fetch(`${BASE_URL}${path}`);
    if (!res.ok) throw new Error(`API error ${res.status}: ${path}`);
    return res.json() as Promise<T>;
}

// --- Public API functions ---

export function fetchCrops(): Promise<Crop[]> {
    return get<Crop[]>("/api/crops");
}

export function fetchMarkets(): Promise<Market[]> {
    return get<Market[]>("/api/markets?with_data=true");
}

export function fetchVarieties(cropId: number, marketId: number): Promise<VarietyRecord[]> {
    return get<VarietyRecord[]>(`/api/varieties?crop_id=${cropId}&market_id=${marketId}`);
}

export function fetchPrices(
    cropId: number,
    marketId: number,
    days = 30,
    variety?: string
): Promise<PriceRecord[]> {
    let url = `/api/prices?crop_id=${cropId}&market_id=${marketId}&days=${days}`;
    if (variety !== undefined && variety.trim() !== "") {
        url += `&variety=${encodeURIComponent(variety.trim())}`;
    }
    return get<PriceRecord[]>(url)
        .then(rows => rows.map(r => ({
            ...r,
            min_price: Number(r.min_price),
            max_price: Number(r.max_price),
            modal_price: Number(r.modal_price),
            varieties_reported: r.varieties_reported !== undefined ? Number(r.varieties_reported) : undefined,
        })));
}

export function fetchSeasonal(cropId: number, marketId: number): Promise<SeasonalRecord[]> {
    return get<SeasonalRecord[]>(`/api/prices/seasonal?crop_id=${cropId}&market_id=${marketId}`)
        .then(rows => rows.map(r => ({
            ...r,
            month: Number(r.month),
            avg_modal_price: Number(r.avg_modal_price),
            data_points: Number(r.data_points),
        })));
}

export function fetchWeather(marketId: number): Promise<WeatherRecord[]> {
    return get<WeatherRecord[]>(`/api/weather?market_id=${marketId}`)
        .then(rows => rows.map(r => ({
            ...r,
            rain_probability: Number(r.rain_probability),
            rain_mm: Number(r.rain_mm),
            temp_min: Number(r.temp_min),
            temp_max: Number(r.temp_max),
        })));
}
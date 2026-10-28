// Wraps the Mandi Price API (mandi-api.onrender.com) — a free, keyless
// community-built service that re-publishes data.gov.in's mandi price
// data for 5 states (including Karnataka), synced daily. We switched to
// this from calling data.gov.in directly because api.data.gov.in's
// government infrastructure was refusing connections outright — a
// known reliability issue with that service, not a bug in our code.
const BASE_URL = "https://mandi-api.onrender.com/v1";

// Shape of one record as this API returns it.
export interface MandiPriceRecord {
    id: number;
    state: string;
    district: string;
    market: string;
    commodity: string;
    variety: string;
    grade: string;
    arrival_date: string; // already "YYYY-MM-DD" — no conversion needed
    min_price: number;    // already numbers, not strings
    max_price: number;
    modal_price: number;
    fetched_at: string;
}

interface MandiApiResponse {
    success: boolean;
    data: MandiPriceRecord[];
    meta: { count: number; state: string; commodity: string };
}

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
            throw new Error(`Mandi API request failed: ${response.status} ${response.statusText}`);
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
        console.warn(`[mandiApiClient] Request failed (${reason}). Retrying once after 5s...`);
        await sleep(5000);
        const retryRes = await fetch(url);
        if (!retryRes.ok) {
            throw new Error(`Mandi API request failed: ${retryRes.status} ${retryRes.statusText}`);
        }
        return retryRes;
    }

    return response!;
}

// Fetches records for a state + commodity, then filters to one district
// ourselves — the API's /v1/prices endpoint doesn't take a district
// filter directly, only state and commodity, so narrowing to one
// district happens in our own code.
export async function fetchMandiPrices(params: {
    state: string;
    district: string;
    commodity: string;
}): Promise<MandiPriceRecord[]> {
    const url = new URL(`${BASE_URL}/prices`);
    url.searchParams.set("state", params.state);
    url.searchParams.set("commodity", params.commodity);

    const response = await fetchWithRetry(url.toString());

    const data = (await response.json()) as MandiApiResponse;

    // Filter down to just the district we care about.
    return data.data.filter(
        (record) => record.district.toLowerCase() === params.district.toLowerCase()
    );
}
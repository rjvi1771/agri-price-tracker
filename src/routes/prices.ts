import { Router, Request, Response, NextFunction } from "express";
import { pool } from "../db/pool";

export const pricesRouter = Router();

// Wrapper to forward async errors to Express's error handler
type AsyncHandler = (req: Request, res: Response, next: NextFunction) => Promise<any>;

const asyncHandler = (fn: AsyncHandler) => {
    return (req: Request, res: Response, next: NextFunction) => {
        fn(req, res, next).catch(next);
    };
};

// Helper: strictly parses positive integers (avoids NaN, floats, negative numbers, non-strings)
function parsePositiveInt(val: unknown): number | null {
    if (typeof val !== "string") return null;
    const num = Number(val);
    if (!Number.isInteger(num) || num <= 0) return null;
    return num;
}


// GET /api/crops — list available crops, for a dropdown in the frontend
pricesRouter.get("/crops", asyncHandler(async (req, res) => {
    const result = await pool.query("SELECT id, name, unit FROM crops ORDER BY name");
    res.json(result.rows);
}));


// GET /api/markets?district=Bengaluru — list markets, optionally filtered
pricesRouter.get("/markets", asyncHandler(async (req, res) => {
    const { district } = req.query;
    const result = typeof district === "string" && district.trim().length > 0
        ? await pool.query("SELECT id, name, district, state FROM markets WHERE district = $1", [district.trim()])
        : await pool.query("SELECT id, name, district, state FROM markets ORDER BY district");
    res.json(result.rows);
}));


pricesRouter.get("/prices", asyncHandler(async (req, res) => {
    const cropId = parsePositiveInt(req.query.crop_id);
    const marketId = parsePositiveInt(req.query.market_id);

    if (!cropId || !marketId) {
        return res.status(400).json({ error: "crop_id and market_id must be valid positive integers" });
    }

    let dayLimit = 30;
    if (req.query.days !== undefined) {
        const parsedDays = parsePositiveInt(req.query.days);
        if (!parsedDays || parsedDays > 365) {
            return res.status(400).json({ error: "days must be a positive integer between 1 and 365" });
        }
        dayLimit = parsedDays;
    }

    const result = await pool.query(
        `SELECT record_date, min_price, max_price, modal_price
         FROM price_records
         WHERE crop_id = $1 AND market_id = $2
         ORDER BY record_date DESC
         LIMIT $3`,
        [cropId, marketId, dayLimit]
    );

    res.json(result.rows);
}));

pricesRouter.get("/prices/seasonal", asyncHandler(async (req, res) => {
    const cropId = parsePositiveInt(req.query.crop_id);
    const marketId = parsePositiveInt(req.query.market_id);

    if (!cropId || !marketId) {
        return res.status(400).json({ error: "crop_id and market_id must be valid positive integers" });
    }

    const result = await pool.query(
        `SELECT EXTRACT(MONTH FROM record_date) AS month,
                ROUND(AVG(modal_price), 2) AS avg_modal_price,
                COUNT(*) AS data_points
         FROM price_records
         WHERE crop_id = $1 AND market_id = $2
         GROUP BY EXTRACT(MONTH FROM record_date)
         ORDER BY month`,
        [cropId, marketId]
    );

    res.json(result.rows);
}));


pricesRouter.get("/weather", asyncHandler(async (req, res) => {
    const marketId = parsePositiveInt(req.query.market_id);

    if (!marketId) {
        return res.status(400).json({ error: "market_id must be a valid positive integer" });
    }

    // (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date ensures the query matches
    // Indian calendar date, even when Supabase server time is UTC.
    const query = req.query.all === "true"
        ? `SELECT record_date, rain_probability, condition, temp_min, temp_max, fetched_at
           FROM weather_records
           WHERE market_id = $1
           ORDER BY record_date ASC`
        : `SELECT record_date, rain_probability, condition, temp_min, temp_max, fetched_at
           FROM weather_records
           WHERE market_id = $1 AND record_date >= (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date
           ORDER BY record_date ASC`;

    const result = await pool.query(query, [marketId]);
    res.json(result.rows);
}));


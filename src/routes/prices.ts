import { Router } from "express";
import { pool } from "../db/pool";

export const pricesRouter = Router();

// GET /api/crops — list available crops, for a dropdown in the frontend
pricesRouter.get("/crops", async (req, res) => {
    const result = await pool.query("SELECT id, name, unit FROM crops ORDER BY name");
    res.json(result.rows);
});

// GET /api/markets?district=Bengaluru — list markets, optionally filtered
pricesRouter.get("/markets", async (req, res) => {
    const { district } = req.query;
    const result = district
        ? await pool.query("SELECT id, name, district, state FROM markets WHERE district = $1", [district])
        : await pool.query("SELECT id, name, district, state FROM markets ORDER BY district");
    res.json(result.rows);
});

// GET /api/prices?crop_id=1&market_id=1&days=30
// Main endpoint — today's price plus a trend over the last N days.
pricesRouter.get("/prices", async (req, res) => {
    const { crop_id, market_id, days } = req.query;

    if (!crop_id || !market_id) {
        // Fail with a clear, specific message rather than a generic 500 —
        // this is a client mistake (missing params), not a server error,
        // so it gets a 400, not a 500.
        return res.status(400).json({ error: "crop_id and market_id are required query parameters" });
    }

    const dayLimit = days ? parseInt(days as string, 10) : 30;

    const result = await pool.query(
        `SELECT record_date, min_price, max_price, modal_price
     FROM price_records
     WHERE crop_id = $1 AND market_id = $2
     ORDER BY record_date DESC
     LIMIT $3`,
        [crop_id, market_id, dayLimit]
    );

    res.json(result.rows);
});

// GET /api/prices/seasonal?crop_id=1&market_id=1
// Averages modal_price by calendar month, across all years of data we
// have. This is the honest replacement for a "predicted price" — it
// shows the farmer what this crop has historically done in each month,
// without us fabricating a forecast we can't actually stand behind.
pricesRouter.get("/prices/seasonal", async (req, res) => {
    const { crop_id, market_id } = req.query;

    if (!crop_id || !market_id) {
        return res.status(400).json({ error: "crop_id and market_id are required query parameters" });
    }

    const result = await pool.query(
        `SELECT EXTRACT(MONTH FROM record_date) AS month,
            ROUND(AVG(modal_price), 2) AS avg_modal_price,
            COUNT(*) AS data_points
     FROM price_records
     WHERE crop_id = $1 AND market_id = $2
     GROUP BY EXTRACT(MONTH FROM record_date)
     ORDER BY month`,
        [crop_id, market_id]
    );

    res.json(result.rows);
});

// GET /api/weather?market_id=1&all=false
// Returns weather records for a market. By default, returns upcoming forecast (today onwards).
pricesRouter.get("/weather", async (req, res) => {
    const { market_id, all } = req.query;

    if (!market_id) {
        return res.status(400).json({ error: "market_id is a required query parameter" });
    }

    const query = all === "true"
        ? `SELECT record_date, rain_probability, condition, temp_min, temp_max, fetched_at
           FROM weather_records
           WHERE market_id = $1
           ORDER BY record_date ASC`
        : `SELECT record_date, rain_probability, condition, temp_min, temp_max, fetched_at
           FROM weather_records
           WHERE market_id = $1 AND record_date >= CURRENT_DATE
           ORDER BY record_date ASC`;

    const result = await pool.query(query, [market_id]);
    res.json(result.rows);
});
import { Pool } from "pg";
import { env } from "../config/env";

// A connection pool, not a single client. Each incoming request (and
// the cron job) borrows a connection and returns it when done. Opening
// a fresh connection per request would be slow and would exhaust
// Postgres's connection limit under any real load.
export const pool = new Pool({
    connectionString: env.databaseUrl,
    ssl: env.databaseUrl.includes("localhost") ? false : { rejectUnauthorized: false },
});

pool.on("error", (err) => {
    // A pooled connection can die while idle (network blip, DB restart).
    // Without this handler, that error crashes the whole process. We just
    // log it — the pool replaces the dead connection automatically.
    console.error("Unexpected error on idle Postgres client", err);
});
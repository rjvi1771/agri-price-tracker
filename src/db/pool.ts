import { Pool, types } from "pg";
import { env } from "../config/env";

// By default, node-postgres parses DATE columns into JS Date objects
// using the server's local timezone, which then get shifted when
// serialized to JSON — a date stored as 2026-09-24 can come back as
// 2026-09-23T18:30:00.000Z over the API. Since our DATE columns have
// no time component anyway, we tell pg to just return them as plain
// "YYYY-MM-DD" strings — no conversion, no ambiguity.
types.setTypeParser(types.builtins.DATE, (value) => value);

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
import express from "express";
import cors from "cors";
import { env } from "./config/env";
import { pricesRouter } from "./routes/prices";
import { startScheduler } from "./cron/scheduler";

const app = express();

app.use(cors()); // allows the React frontend (different port) to call this API
app.use(express.json());

// Simple health check — useful once this is deployed, to confirm the
// server is actually up without hitting a real data endpoint.
app.get("/health", (req, res) => {
    res.json({ status: "ok" });
});

app.use("/api", pricesRouter);
// Express error middleware — catches any error passed via next(err)
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error("[server error]", err);
    res.status(500).json({ error: "Internal server error" });
});


app.listen(env.port, () => {
    console.log(`[server] Listening on port ${env.port}`);
    if (env.enableScheduler === "true") {
        startScheduler();
    } else {
        console.log("[server] In-process scheduler disabled (ENABLE_SCHEDULER != 'true')");
    }
});
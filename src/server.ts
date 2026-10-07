import express from "express";
import cors from "cors";
import { env } from "./config/env";
import { pricesRouter } from "./routes/prices";

const app = express();

app.use(cors()); // allows the React frontend (different port) to call this API
app.use(express.json());

// Simple health check — useful once this is deployed, to confirm the
// server is actually up without hitting a real data endpoint.
app.get("/health", (req, res) => {
    res.json({ status: "ok" });
});

app.use("/api", pricesRouter);

app.listen(env.port, () => {
    console.log(`[server] Listening on port ${env.port}`);
});
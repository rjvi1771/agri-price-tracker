# Agri Price Tracker: Project Context

> **For the AI assistant in the IDE: read this whole file before suggesting or changing anything.**
> It describes what exists today, what is planned, and how I want to work with you.

---


- Never put secrets in code, and never commit `.env`.
- Don't add features outside the roadmap 
- If something I ask for is a bad idea, say so and explain why.
- When you change a data source or API, check the **real response shape** before writing code against it. A past source switch changed date and number formats.

---

## 1. What this project is

A **full-stack web application** (not a mobile app) that shows Indian farmers:

1. **Mandi (wholesale market) crop prices**: today's price plus a recent trend, per crop and market.
2. **Seasonal price history**: what a crop has historically fetched in each calendar month. This deliberately replaces a "predicted future price". Price forecasting is unreliable (export bans, aggregate sowing cycles) and I won't present a made-up number as a forecast.
3. **Weather forecast per market location**: rain probability and temperature for the coming days.

**First market and crop:** Bengaluru, Karnataka; Onion. The data model supports more crops and markets.

**Original idea, parked for later:** disease detection from photos, power outage and lineman directory, farmer-to-buyer marketplace. These are *out of scope* for this version.

---

## 2. End result (definition of done)

A deployed web app with a public URL where a user can:

- Pick a crop and a market.
- See today's modal, min and max price and a 30-day price trend chart.
- See a seasonal chart (average modal price by month, with the number of data points shown honestly).
- See a 5–6 day weather forecast with rain % per day.

Plus, for the resume:

- Live frontend and backend links, a GitHub repo with a clear README, clean incremental commit history, an architecture diagram, and a short list of design decisions I can defend.

---

## 3. Tech stack

| Layer | Choice | Why |
|---|---|---|
| Language | TypeScript (`strict: true`) both ends | Listed on most full-stack JDs; forces handling of null/undefined |
| Backend | Node.js + Express 4 | Plain Express teaches fundamentals; no framework magic |
| Database | PostgreSQL on Supabase (free tier) | Data is relational and time-series (crop, market, date, price) |
| DB driver | `pg` (raw SQL, no ORM) | I need to explain every query and index |
| Scheduler | `node-cron` | In-process daily/6-hourly sync, no job queue needed at this scale |
| Dev runner | `tsx` | Runs TS directly with auto-reload |
| Config | `dotenv` + a fail-fast `env.ts` | Missing keys fail loudly at startup |
| CORS | `cors` | Lets the React app call the API from another origin |
| Frontend (planned) | React + TypeScript via **Vite** | Not CRA (deprecated) |
| Charts (planned) | Recharts | |
| Hosting (planned) | Backend: Render; Frontend: Vercel; DB: Supabase | All have free tiers |

Runtime on my machine: Node v24, Windows, Antigravity IDE.

---

## 4. Architecture

```
 mandi-api.onrender.com        api.openweathermap.org
   (community mirror of            (5-day / 3-hour forecast)
    data.gov.in mandi data)
            |                              |
            v                              v
   mandiApiClient.ts               weatherClient.ts
            |                              |
            v                              v
   syncPrices.ts  (cron)           syncWeather.ts  (cron)
            \                              /
             \--------> PostgreSQL <------/
                        (Supabase)
                            ^
                            |  raw SQL via pg Pool
                            |
                  Express API  (routes/prices.ts)
                            ^
                            |  JSON over HTTP
                            |
               React + Vite frontend  (planned, client/)
```

Key principle: **the app never calls external APIs per user request.** Cron jobs pull data into Postgres; the API only reads from Postgres. That keeps responses fast, avoids external rate limits, and lets the app keep serving data if an upstream source goes down.

---

## 5. Folder structure

Backend lives at the repo root. The frontend will be added as `client/`.

```
agri-price-tracker/
  package.json
  tsconfig.json
  .gitignore
  .env                 (never committed)
  .env.example
  PROJECT_CONTEXT.md   (this file)
  src/
    server.ts          Express app; mounts routes; starts scheduler
    config/env.ts      Reads and validates env vars
    db/
      pool.ts          pg Pool + DATE type parser override
      migrations/001_init.sql   Schema + seed rows
    services/
      mandiApiClient.ts   Fetches mandi prices (state + commodity), filters district
      weatherClient.ts    Fetches forecast, collapses 3-hour blocks to daily rows
    cron/
      syncPrices.ts    Upserts price rows for one crop + district
      syncWeather.ts   syncWeatherForMarket + syncAllMarketsWeather
      scheduler.ts     node-cron registration (startScheduler)
    routes/
      prices.ts        All read endpoints (crops, markets, prices, seasonal, weather)
  client/              (planned) React + Vite + TS
```

`package.json` scripts: `dev`, `build`, `start`, `sync:prices`, `sync:weather`.

---

## 6. Environment variables (`.env`)

```
DATABASE_URL=postgresql://postgres.<project-ref>:<password>@aws-0-ap-south-1.pooler.supabase.com:6543/postgres
OPENWEATHER_API_KEY=<key>
PORT=5000
```

Gotchas:

- Use Supabase's **transaction pooler** string. Remove the `[ ]` brackets from the password placeholder.
- If the password contains `@`, URL-encode it as `%40`.
- There is **no** data.gov.in key any more (see section 8).
- `env.ts` throws at import time if `DATABASE_URL` or `OPENWEATHER_API_KEY` is missing. This is intentional.

---

## 7. Database schema

Defined in `src/db/migrations/001_init.sql`, run by hand in Supabase's SQL editor. RLS is enabled on the tables (the Express backend connects with the full connection string, which bypasses RLS).

```sql
crops(id SERIAL PK, name VARCHAR(100) UNIQUE NOT NULL, name_kn VARCHAR(100), unit VARCHAR(20) DEFAULT 'quintal')

markets(id SERIAL PK, name VARCHAR(150) NOT NULL, district VARCHAR(100) NOT NULL,
        state VARCHAR(100) DEFAULT 'Karnataka', latitude DECIMAL(9,6), longitude DECIMAL(9,6),
        UNIQUE(name, district))

price_records(id SERIAL PK, crop_id FK, market_id FK, record_date DATE NOT NULL,
              min_price, max_price, modal_price DECIMAL(10,2), arrival_qty DECIMAL(10,2),
              source VARCHAR(50) DEFAULT 'agmarknet', created_at TIMESTAMP DEFAULT NOW(),
              UNIQUE(crop_id, market_id, record_date))
   + INDEX idx_price_lookup (crop_id, market_id, record_date)

weather_records(id SERIAL PK, market_id FK, record_date DATE NOT NULL, rain_probability INT,
                condition VARCHAR(50), temp_min, temp_max DECIMAL(4,1), fetched_at TIMESTAMP DEFAULT NOW(),
                UNIQUE(market_id, record_date))
```

Seed data: crop `Onion`; markets `Mandya` (id 1) and `Bengaluru` (id 2, lat 12.9716, lon 77.5946).

The `UNIQUE` constraints plus `ON CONFLICT ... DO UPDATE` make both sync jobs **idempotent**: running them twice gives the same result.

---

## 8. Data sources

### Prices: Mandi Price API (community wrapper)
- Base URL: `https://mandi-api.onrender.com/v1`. Keyless. Rate limit **100 requests per 15 minutes per IP**.
- It re-publishes data.gov.in / Agmarknet mandi prices for 5 states: Maharashtra, Uttar Pradesh, Punjab, Madhya Pradesh, Karnataka.
- Endpoints: `/states`, `/commodities?state=`, `/markets?state=`, `/prices?state=&commodity=`, `/prices/history?state=&commodity=`. `/prices` requires `state` or `commodity`.
- **Why not data.gov.in directly:** `api.data.gov.in` refused connections from my network (ECONNREFUSED, also in the browser).
- Record shape: `{ id, state, district, market, commodity, variety, grade, arrival_date: "YYYY-MM-DD", min_price, max_price, modal_price (numbers), fetched_at }`.
- The API has **no district filter** on `/prices`, so `mandiApiClient.ts` filters by district in our own code.
- It's a volunteer project: no SLA, may sleep (Render free tier), could be abandoned. Treat it as replaceable.

### Weather: OpenWeatherMap free forecast
- `GET /data/2.5/forecast?lat=&lon=&appid=&units=metric` returns 40 entries (5 days, 3-hour blocks).
- `weatherClient.ts` groups entries by date and keeps: **max** rain probability (`pop` x 100) for the day, min/max temperature, and the midday entry's condition. Max, not average, because a farmer cares about the worst-case window.

---

## 9. Backend behaviour (file by file)

- **`config/env.ts`**: loads `.env`, exports `env.port`, `env.databaseUrl`, `env.openWeatherApiKey`.
- **`db/pool.ts`**: `pg` Pool with SSL (off for localhost). Calls `types.setTypeParser(types.builtins.DATE, v => v)` so DATE columns return as `"YYYY-MM-DD"` strings. Without it, dates shifted a day in JSON because of the IST/UTC conversion.
- **`services/mandiApiClient.ts`**: `fetchMandiPrices({state, district, commodity})`; throws on non-OK responses.
- **`services/weatherClient.ts`**: `fetchWeatherForecast(lat, lon)` returns `DailyWeather[]`.
- **`cron/syncPrices.ts`**: `syncPricesForMarket(crop, district, state)` looks up internal IDs, fetches, upserts. **Its `require.main` block is hardcoded to Onion/Bengaluru**, so it is only a manual test entry point.
- **`cron/syncWeather.ts`**: `syncWeatherForMarket(marketId, lat, lon)` and `syncAllMarketsWeather()` (loops every market that has coordinates; one failure doesn't stop the rest).
- **`cron/scheduler.ts`**: `startScheduler()`. Prices daily at 07:00 IST (loops all crops x all markets, sequentially because of the rate limit); weather every 6 hours. Uses `timezone: "Asia/Kolkata"`. Called from the `app.listen` callback in `server.ts`.
- **`routes/prices.ts`**: the read endpoints below.

---

## 10. API reference (mounted under `/api`, plus `/health`)

| Method + path | Params | Returns |
|---|---|---|
| `GET /health` | | `{status:"ok"}` |
| `GET /api/crops` | | `[{id, name, unit}]` |
| `GET /api/markets` | `district?` | `[{id, name, district, state}]` |
| `GET /api/prices` | `crop_id`, `market_id` (required), `days` (default 30) | `[{record_date, min_price, max_price, modal_price}]`, newest first |
| `GET /api/prices/seasonal` | `crop_id`, `market_id` | `[{month, avg_modal_price, data_points}]` |
| `GET /api/weather` | `market_id` (required), `all=true` optional | `[{record_date, rain_probability, condition, temp_min, temp_max, fetched_at}]`, today onwards by default |

**Type gotcha for the frontend:** `pg` returns `DECIMAL`, `EXTRACT` and `COUNT` values as **strings** (`"3500.00"`, `"9"`). Convert with `Number()` before charting. Missing required params return 400.

---

## 11. Current status

Done and verified:
- Project scaffold, schema, pool, env config.
- Price sync: 59 Onion records upserted for Bengaluru.
- Weather sync: 12 rows (6 days x 2 markets).
- API routes tested in the browser, including the date-format fix.
- Scheduler registers on server start (log line seen). **A scheduled run itself has not been observed yet.**
- Backend commits pushed to GitHub as `agri-price-tracker`.

Not done: everything in section 14.

---

## 12. Known issues and gotchas

1. **Price data freshness [VERIFIED / LIVE]:** Checked upstream API (`https://mandi-api.onrender.com/v1/prices`). Upstream is actively syncing daily data (latest records from 2026-10-13, 200 records each for Onion, Tomato, Potato).
2. **Express 4 does not catch errors in `async` route handlers [RESOLVED]:** Implemented `asyncHandler` wrapper across all endpoints in `src/routes/prices.ts` and registered an Express 500 error handler middleware in `src/server.ts`.
3. **No validation on `days`, `crop_id`, `market_id` [RESOLVED]:** Added `parsePositiveInt` and bounds checking (e.g. days between 1 and 365) in `src/routes/prices.ts`, returning clear 400 errors on invalid inputs.
4. **Mandya returns no onion data [INVESTIGATED]:** Verified via Mandi API Karnataka dataset. Mandya APMC (K.R. Pet APMC in Mandya) does not record onion arrivals in Agmarknet. Karnataka onion trade is reported in Bengaluru, Mysuru, Kolar, Davangere, etc.
5. **Seasonal endpoint is thin [HANDLED]:** Returns `data_points` count per month. The frontend will display the data count and show a "Limited historical data" indicator if data points are low. Upstream `/prices/history` is verified for backfills.
6. **Weather date grouping uses UTC [RESOLVED]:** Shifted the unix `dt` by `+19800` s (IST = UTC + 5:30) in `src/services/weatherClient.ts` so evening forecast blocks map to their correct Indian calendar date, and aligned midday condition selection to 11:00-14:00 IST.
7. **`CURRENT_DATE` in the weather query is UTC [RESOLVED]:** Updated query in `src/routes/prices.ts` to use `(CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date` so midnight-to-morning queries in India correctly match today's date.
8. **Outliers exist in the source data [RESOLVED]:** Added a sanity filter in `src/cron/syncPrices.ts` (`isPlausible`: checks positive values, `min_price <= max_price`, `modal_price` within bounds, and `max_price <= modal_price * 4`) to prevent corrupted government portal records from skewing trends.
9. **In-process cron stops when the server sleeps [ARCHITECTURAL NOTE]:** On Render free tier, server spins down after inactivity. Recommended to trigger `sync:prices` and `sync:weather` via a scheduled GitHub Action or external ping during deployment (Phase C).
10. **Windows: always `await pool.end()` before `process.exit()` [RESOLVED]:** All standalone cron scripts (`syncPrices.ts`, `syncWeather.ts`) properly await `pool.end()` before exiting to eliminate libuv assertions on Windows.

---

## 13. Out of scope for this version

Marketplace, buyer/seller flows, payments, disease detection, power outage directory, price forecasting as a number, ORM, microservices, native mobile app.

---

## 14. Roadmap (do in this order)

**Phase A: finish the backend**
1. Temporarily set the price cron to `* * * * *`, watch one run, revert to `0 7 * * *`.
2. Check data freshness (issue 1) and decide what to do.
3. Add async error handling and input validation to the routes (issues 2, 3).
4. Add crops (Tomato, Potato) and markets (e.g. Mysuru). Confirm exact names via `/v1/commodities?state=Karnataka` and `/v1/markets?state=Karnataka`; the `crops.name` value must match the API's commodity name exactly.
5. Make a "sync everything" entry point (loop crops x markets) so `npm run sync:prices` isn't hardcoded to Onion/Bengaluru.
6. Fix issues 6 and 7 if time allows.

**Phase B: frontend (`client/`)**
- Scaffold with Vite (React + TS). `VITE_API_URL` env var for the backend base URL.
- `src/api.ts`: typed fetch wrappers for each endpoint, converting string numbers.
- Components: `CropMarketSelector`, `PriceCard` (today's modal/min/max), `PriceTrendChart` (30 days, Recharts line), `SeasonalChart` (bar chart by month with data-point count), `WeatherStrip` (one card per day: icon/condition, rain %, min/max temp).
- Every data view needs loading, error and empty states.
- Mobile-first layout (users are on phones). Show "last updated" next to prices and weather.
- Keep UI strings in one place so Kannada can be added later.

**Phase C: deployment**
- Backend on Render, frontend on Vercel, DB already on Supabase. Lock CORS to the frontend origin in production.
- Scheduling: don't rely on in-process cron on a sleeping free server. Run the sync scripts from a **GitHub Actions scheduled workflow** (`DATABASE_URL` and `OPENWEATHER_API_KEY` as repo secrets), which needs no public sync endpoint.

**Phase D: resume polish**
- README: problem statement, screenshots, architecture diagram, stack and the "why" for each choice, setup steps, data-source caveats (including the stale-data note), live links.
- A few tests (date parsing, daily weather grouping, API param validation).
- Keep commits small and meaningful.

**Later, optional:** Kannada UI, PWA/offline caching, auth + saved crops + price alerts, a second portfolio project with WebSockets.

---

## 15. Interview talking points this project supports

- Why Postgres over Mongo for this data; why raw SQL.
- Cron-sync-into-DB instead of calling external APIs per request; idempotent upserts with `ON CONFLICT`.
- Debugging stories: the DATE timezone shift, the Windows `process.exit` assertion, data-source failure and fallback, URL-encoding a password.
- Product judgement: showing seasonal history instead of fake forecasts; max (not average) rain probability.
- Honest handling of an unreliable upstream (community API, stale data, rate limits).
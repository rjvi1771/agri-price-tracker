import { useEffect, useState } from "react";
import { fetchWeather } from "../api";
import type { WeatherRecord } from "../api";

interface Props {
    marketId: number;
}

const MONTH_NAMES = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function formatDayMonth(dateStr: string): string {
    const parts = dateStr.split("-");
    if (parts.length === 3) {
        const monthIndex = Number(parts[1]) - 1;
        const day = Number(parts[2]);
        const month = MONTH_NAMES[monthIndex] ?? parts[1];
        return `${day} ${month}`;
    }
    return dateStr;
}

function formatFetchedAt(isoStr: string): string {
    try {
        const d = new Date(isoStr);
        return d.toLocaleDateString("en-IN", {
            day: "numeric",
            month: "short",
            year: "numeric",
        });
    } catch {
        return isoStr;
    }
}

function getWeatherIcon(condition: string): string {
    const cond = condition.toLowerCase();
    if (cond.includes("rain")) return "🌧️";
    if (cond.includes("cloud")) return "☁️";
    if (cond.includes("clear")) return "☀️";
    if (cond.includes("thunder")) return "⛈️";
    if (cond.includes("snow")) return "❄️";
    return "🌤️";
}

export function WeatherStrip({ marketId }: Props) {
    const [weather, setWeather] = useState<WeatherRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        setLoading(true);
        setError(null);
        fetchWeather(marketId)
            .then(rows => {
                setWeather(rows);
                setLoading(false);
            })
            .catch(() => {
                setError("Failed to load weather data");
                setLoading(false);
            });
    }, [marketId]);

    if (loading) return <div className="card loading-card"><p>Loading weather forecast...</p></div>;
    if (error) return <div className="card error-card"><p>{error}</p></div>;
    if (weather.length === 0) {
        return (
            <div className="card">
                <h2>Weather Forecast</h2>
                <p className="empty-text">No weather data available</p>
            </div>
        );
    }

    const fetchedDate = formatFetchedAt(weather[0].fetched_at);

    return (
        <div className="card weather-card">
            <div className="card-header">
                <h2>Weather Forecast</h2>
                <span className="last-updated">Forecast fetched {fetchedDate}</span>
            </div>
            <div className="weather-strip">
                {weather.map(item => (
                    <div key={item.record_date} className="weather-day-card">
                        <div className="weather-date">{formatDayMonth(item.record_date)}</div>
                        <div className="weather-icon" title={item.condition}>
                            {getWeatherIcon(item.condition)}
                        </div>
                        <div className="weather-condition">{item.condition}</div>
                        <div className="weather-rain">
                            💧 {Math.round(item.rain_probability)}%
                        </div>
                        <div className="weather-temp">
                            {Math.round(item.temp_min)}° – {Math.round(item.temp_max)}°C
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

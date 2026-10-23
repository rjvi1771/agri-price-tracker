import { useEffect, useState } from "react";
import { fetchPrices } from "../api";
import type { PriceRecord } from "../api";
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from "recharts";

interface Props {
    cropId: number;
    marketId: number;
}

interface ChartPoint extends PriceRecord {
    timestamp: number;
}

export function PriceTrendChart({ cropId, marketId }: Props) {
    const [data, setData] = useState<ChartPoint[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        setLoading(true);
        setError(null);
        fetchPrices(cropId, marketId, 30)
            .then(rows => {
                // API returns newest first — reverse for the chart (oldest on left)
                const mapped = [...rows].reverse().map(r => ({
                    ...r,
                    timestamp: new Date(`${r.record_date}T00:00:00`).getTime(),
                }));
                setData(mapped);
                setLoading(false);
            })
            .catch(() => {
                setError("Failed to load price trend");
                setLoading(false);
            });
    }, [cropId, marketId]);

    if (loading) return <div className="card loading-card"><p>Loading chart...</p></div>;
    if (error) return <div className="card error-card"><p>{error}</p></div>;
    if (data.length === 0) return <div className="card"><p className="empty-text">No trend data available.</p></div>;

    return (
        <div className="card">
            <h2>30-Day Price Trend (₹/quintal)</h2>
            <ResponsiveContainer width="100%" height={260}>
                <LineChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                    <XAxis
                        dataKey="timestamp"
                        type="number"
                        domain={["dataMin", "dataMax"]}
                        tickFormatter={(ts: number) => {
                            const d = new Date(ts);
                            const month = String(d.getMonth() + 1).padStart(2, "0");
                            const day = String(d.getDate()).padStart(2, "0");
                            return `${month}-${day}`;
                        }}
                        stroke="#6b7280"
                        tickLine={false}
                    />
                    <YAxis stroke="#6b7280" tickLine={false} />
                    <Tooltip
                        labelFormatter={(label) => {
                            if (!label) return "";
                            const d = new Date(Number(label));
                            return d.toLocaleDateString("en-IN", {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                            });
                        }}
                        formatter={(value) => [
                            value != null ? `₹${Number(value).toLocaleString("en-IN")}` : "N/A",
                            "Modal price",
                        ]}
                    />
                    <Line
                        type="monotone"
                        dataKey="modal_price"
                        stroke="#16a34a"
                        strokeWidth={2}
                        dot={false}
                        name="Modal price"
                    />
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
}

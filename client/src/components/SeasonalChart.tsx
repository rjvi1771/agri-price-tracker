import { useEffect, useState } from "react";
import { fetchSeasonal } from "../api";
import type { SeasonalRecord } from "../api";
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
} from "recharts";

interface Props {
    cropId: number;
    marketId: number;
}

interface ChartItem extends SeasonalRecord {
    monthName: string;
}

const MONTH_NAMES = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

interface CustomTooltipProps {
    active?: boolean;
    payload?: Array<{ payload: ChartItem }>;
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
    if (active && payload && payload.length > 0) {
        const item = payload[0].payload;
        return (
            <div className="chart-tooltip">
                <p className="tooltip-title">{item.monthName}</p>
                <p className="tooltip-price">₹{item.avg_modal_price.toLocaleString("en-IN")} / quintal</p>
                <p className="tooltip-sub">
                    Based on {item.data_points} {item.data_points === 1 ? "day" : "days"} of data
                </p>
            </div>
        );
    }
    return null;
}

export function SeasonalChart({ cropId, marketId }: Props) {
    const [data, setData] = useState<ChartItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        setLoading(true);
        setError(null);
        fetchSeasonal(cropId, marketId)
            .then(rows => {
                const formatted = rows
                    .sort((a, b) => a.month - b.month)
                    .map(r => ({
                        ...r,
                        monthName: MONTH_NAMES[r.month - 1] ?? `Month ${r.month}`,
                    }));
                setData(formatted);
                setLoading(false);
            })
            .catch(() => {
                setError("Failed to load seasonal data");
                setLoading(false);
            });
    }, [cropId, marketId]);

    if (loading) return <div className="card loading-card"><p>Loading seasonal data...</p></div>;
    if (error) return <div className="card error-card"><p>{error}</p></div>;
    if (data.length === 0) {
        return (
            <div className="card">
                <h2>Seasonal Price Patterns</h2>
                <p className="empty-text">No seasonal data available.</p>
            </div>
        );
    }

    const hasLimitedData = data.some(d => d.data_points < 5);

    return (
        <div className="card">
            <h2>Seasonal Price Patterns (₹/quintal)</h2>
            <ResponsiveContainer width="100%" height={260}>
                <BarChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                    <XAxis dataKey="monthName" stroke="#6b7280" tickLine={false} />
                    <YAxis stroke="#6b7280" tickLine={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="avg_modal_price" fill="#16a34a" radius={[4, 4, 0, 0]} name="Avg Modal Price" />
                </BarChart>
            </ResponsiveContainer>
            {hasLimitedData && (
                <p className="note-text">
                    Limited historical data — seasonal chart will improve over time
                </p>
            )}
        </div>
    );
}

import { useEffect, useState } from "react";
import { fetchPrices } from "../api";
import type { PriceRecord } from "../api";

interface Props {
    cropId: number;
    marketId: number;
}

export function PriceCard({ cropId, marketId }: Props) {
    const [latest, setLatest] = useState<PriceRecord | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        setLoading(true);
        setError(null);
        fetchPrices(cropId, marketId, 1)
            .then(rows => {
                setLatest(rows[0] ?? null);
                setLoading(false);
            })
            .catch(() => {
                setError("Failed to load price data");
                setLoading(false);
            });
    }, [cropId, marketId]);

    if (loading) return <div className="card loading-card"><p>Loading prices...</p></div>;
    if (error) return <div className="card error-card"><p>{error}</p></div>;
    if (!latest) return <div className="card"><p>No price data available for this crop and market.</p></div>;

    return (
        <div className="card price-card">
            <div className="card-header">
                <h2>Latest Price</h2>
                <span className="last-updated">Data as of {latest.record_date}</span>
            </div>
            <div className="price-highlight">
                <span className="price-main">₹{latest.modal_price.toLocaleString("en-IN")}</span>
                <span className="price-unit">/ quintal</span>
            </div>
            <div className="price-range">
                <span>Min: ₹{latest.min_price.toLocaleString("en-IN")}</span>
                <span className="separator">•</span>
                <span>Max: ₹{latest.max_price.toLocaleString("en-IN")}</span>
            </div>
        </div>
    );
}
import { useEffect, useState } from "react";
import { fetchCrops, fetchMarkets } from "../api";
import type { Crop, Market } from "../api";

interface Props {
    onSelect: (cropId: number, marketId: number) => void;
}

export function CropMarketSelector({ onSelect }: Props) {
    const [crops, setCrops] = useState<Crop[]>([]);
    const [markets, setMarkets] = useState<Market[]>([]);
    const [selectedCrop, setSelectedCrop] = useState<number | null>(null);
    const [selectedMarket, setSelectedMarket] = useState<number | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        Promise.all([fetchCrops(), fetchMarkets()])
            .then(([cropData, marketData]) => {
                setCrops(cropData);
                setMarkets(marketData);
            })
            .catch(() => setError("Failed to load crops and markets"));
    }, []);

    function handleCropChange(e: React.ChangeEvent<HTMLSelectElement>) {
        const id = Number(e.target.value);
        setSelectedCrop(id);
        if (selectedMarket) onSelect(id, selectedMarket);
    }

    function handleMarketChange(e: React.ChangeEvent<HTMLSelectElement>) {
        const id = Number(e.target.value);
        setSelectedMarket(id);
        if (selectedCrop) onSelect(selectedCrop, id);
    }

    if (error) return <div className="card error-card"><p>{error}</p></div>;

    return (
        <div className="card selector-card">
            <div className="form-group">
                <label htmlFor="crop-select">Crop</label>
                <select id="crop-select" onChange={handleCropChange} defaultValue="">
                    <option value="" disabled>Select crop</option>
                    {crops.map(c => (
                        <option key={c.id} value={c.id}>{c.name} ({c.unit})</option>
                    ))}
                </select>
            </div>

            <div className="form-group">
                <label htmlFor="market-select">Market</label>
                <select id="market-select" onChange={handleMarketChange} defaultValue="">
                    <option value="" disabled>Select market</option>
                    {markets.map(m => (
                        <option key={m.id} value={m.id}>{m.name}, {m.district}</option>
                    ))}
                </select>
            </div>
        </div>
    );
}
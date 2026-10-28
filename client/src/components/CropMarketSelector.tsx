import { useEffect, useState } from "react";
import { fetchCrops, fetchMarkets, fetchVarieties } from "../api";
import type { Crop, Market, VarietyRecord } from "../api";

interface Props {
    onSelect: (cropId: number, marketId: number, variety: string | null) => void;
}

export function CropMarketSelector({ onSelect }: Props) {
    const [crops, setCrops] = useState<Crop[]>([]);
    const [markets, setMarkets] = useState<Market[]>([]);
    const [varieties, setVarieties] = useState<VarietyRecord[]>([]);
    const [selectedCrop, setSelectedCrop] = useState<number | null>(null);
    const [selectedMarket, setSelectedMarket] = useState<number | null>(null);
    const [selectedVariety, setSelectedVariety] = useState<string>("");
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        Promise.all([fetchCrops(), fetchMarkets()])
            .then(([cropData, marketData]) => {
                setCrops(cropData);
                setMarkets(marketData);
            })
            .catch(() => setError("Failed to load crops and markets"));
    }, []);

    useEffect(() => {
        if (selectedCrop && selectedMarket) {
            fetchVarieties(selectedCrop, selectedMarket)
                .then(data => setVarieties(data))
                .catch(() => setVarieties([]));
        } else {
            setVarieties([]);
        }
    }, [selectedCrop, selectedMarket]);

    function handleCropChange(e: React.ChangeEvent<HTMLSelectElement>) {
        const id = Number(e.target.value);
        setSelectedCrop(id);
        setSelectedVariety("");
        if (selectedMarket) {
            onSelect(id, selectedMarket, null);
        }
    }

    function handleMarketChange(e: React.ChangeEvent<HTMLSelectElement>) {
        const id = Number(e.target.value);
        setSelectedMarket(id);
        setSelectedVariety("");
        if (selectedCrop) {
            onSelect(selectedCrop, id, null);
        }
    }

    function handleVarietyChange(e: React.ChangeEvent<HTMLSelectElement>) {
        const val = e.target.value;
        setSelectedVariety(val);
        if (selectedCrop && selectedMarket) {
            onSelect(selectedCrop, selectedMarket, val ? val : null);
        }
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

            <div className="form-group">
                <label htmlFor="variety-select">Variety</label>
                <select
                    id="variety-select"
                    value={selectedVariety}
                    onChange={handleVarietyChange}
                    disabled={!selectedCrop || !selectedMarket}
                >
                    <option value="">All varieties (average)</option>
                    {varieties.map(v => (
                        <option key={v.variety} value={v.variety}>
                            {v.variety}{v.grade ? ` (${v.grade})` : ""}
                        </option>
                    ))}
                </select>
            </div>
        </div>
    );
}
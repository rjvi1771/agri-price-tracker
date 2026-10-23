import { useState } from "react";
import { CropMarketSelector } from "./components/CropMarketSelector";
import { PriceCard } from "./components/PriceCard";
import { PriceTrendChart } from "./components/PriceTrendChart";
import { SeasonalChart } from "./components/SeasonalChart";
import { WeatherStrip } from "./components/WeatherStrip";

interface Selection {
  cropId: number;
  marketId: number;
}

function App() {
  const [selection, setSelection] = useState<Selection | null>(null);

  function handleSelect(cropId: number, marketId: number) {
    setSelection({ cropId, marketId });
  }

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="header-badge">Agri Tracker</div>
        <h1>Agri Price Tracker</h1>
        <p className="header-subtitle">Real-time market mandi prices and weather intelligence</p>
      </header>

      <main className="app-main">
        <CropMarketSelector onSelect={handleSelect} />

        {selection && (
          <div className="tracker-content">
            <PriceCard cropId={selection.cropId} marketId={selection.marketId} />
            <PriceTrendChart cropId={selection.cropId} marketId={selection.marketId} />
            <SeasonalChart cropId={selection.cropId} marketId={selection.marketId} />
            <WeatherStrip marketId={selection.marketId} />
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
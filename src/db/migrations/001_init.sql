
CREATE TABLE IF NOT EXISTS crops (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  name_kn VARCHAR(100),
  unit VARCHAR(20) DEFAULT 'quintal'
);

CREATE TABLE IF NOT EXISTS markets (
  id SERIAL PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  district VARCHAR(100) NOT NULL,
  state VARCHAR(100) NOT NULL DEFAULT 'Karnataka',
  latitude DECIMAL(9,6),
  longitude DECIMAL(9,6),
  UNIQUE(name, district)
);

CREATE TABLE IF NOT EXISTS price_records (
  id SERIAL PRIMARY KEY,
  crop_id INT NOT NULL REFERENCES crops(id),
  market_id INT NOT NULL REFERENCES markets(id),
  record_date DATE NOT NULL,
  min_price DECIMAL(10,2),
  max_price DECIMAL(10,2),
  modal_price DECIMAL(10,2),
  arrival_qty DECIMAL(10,2),
  source VARCHAR(50) DEFAULT 'agmarknet',
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(crop_id, market_id, record_date)
);
CREATE INDEX IF NOT EXISTS idx_price_lookup ON price_records(crop_id, market_id, record_date);

CREATE TABLE IF NOT EXISTS weather_records (
  id SERIAL PRIMARY KEY,
  market_id INT NOT NULL REFERENCES markets(id),
  record_date DATE NOT NULL,
  rain_probability INT,
  condition VARCHAR(50),
  temp_min DECIMAL(4,1),
  temp_max DECIMAL(4,1),
  fetched_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(market_id, record_date)
);

INSERT INTO crops (name, unit) VALUES ('Onion', 'quintal') ON CONFLICT (name) DO NOTHING;
INSERT INTO markets (name, district, state, latitude, longitude)
  VALUES ('Mandya', 'Mandya', 'Karnataka', 12.5242, 76.8958)
  ON CONFLICT (name, district) DO NOTHING;
INSERT INTO markets (name, district, state, latitude, longitude)
  VALUES ('Bengaluru', 'Bengaluru', 'Karnataka', 12.9716, 77.5946)
  ON CONFLICT (name, district) DO NOTHING;
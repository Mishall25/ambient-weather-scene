const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(express.static(__dirname));

/**
 * GET /api/geocode?city=NAME
 * Turns a city name into lat/lon using Open-Meteo's free geocoding API.
 * We proxy this server-side so the frontend never talks to a third party
 * directly (no CORS headaches, no API keys exposed).
 */
app.get('/api/geocode', async (req, res) => {
  const { city } = req.query;
  if (!city) return res.status(400).json({ error: 'city is required' });

  try {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1`;
    const response = await fetch(url);
    const data = await response.json();

    if (!data.results || data.results.length === 0) {
      return res.status(404).json({ error: 'city not found' });
    }

    const { latitude, longitude, name, country } = data.results[0];
    res.json({ latitude, longitude, name, country });
  } catch (err) {
    console.error('geocode error:', err);
    res.status(500).json({ error: 'failed to geocode city' });
  }
});

/**
 * GET /api/weather?lat=..&lon=..
 * Fetches current conditions (temperature, weather code, day/night flag)
 * from Open-Meteo's free forecast API — no API key required.
 */
app.get('/api/weather', async (req, res) => {
  const { lat, lon } = req.query;
  if (!lat || !lon) return res.status(400).json({ error: 'lat and lon are required' });

  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code,is_day&timezone=auto`;
    const response = await fetch(url);
    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error('weather error:', err);
    res.status(500).json({ error: 'failed to fetch weather' });
  }
});

app.listen(PORT, () => {
  console.log(`🌤  Ambient weather scene running at http://localhost:${PORT}`);
});
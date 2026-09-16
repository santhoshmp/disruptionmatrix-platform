// open-meteo.js — Open-Meteo weather forecast connector
// Free, no API key. General weather forecasts (not aviation-specific).
// Source: https://api.open-meteo.com/v1/forecast
//
// Provides: temperature, wind speed/direction, precipitation, severe weather indicators
// Complements aviationweather.gov METAR data with broader regional forecasts.
// Useful for: heatwaves, flooding, storms not yet at METAR threshold, dust storms.

import { fetchWithTimeout } from './http-utils.js';

const BASE_URL = 'https://api.open-meteo.com/v1/forecast';
const TIMEOUT_MS = 8000;
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 min cache

const cache = new Map(); // key: "lat,lon" → { data, time }

// Airport coordinates (subset — extend as needed)
const AIRPORT_COORDS = {
  // India
  BLR: { lat: 13.2, lon: 77.7 }, DEL: { lat: 28.6, lon: 77.1 }, BOM: { lat: 19.1, lon: 72.9 },
  MAA: { lat: 13.0, lon: 80.2 }, HYD: { lat: 17.2, lon: 78.4 }, COK: { lat: 10.2, lon: 76.4 },
  CCU: { lat: 22.7, lon: 88.3 }, GOI: { lat: 15.4, lon: 73.8 },
  // Europe
  VIE: { lat: 48.1, lon: 16.6 }, MUC: { lat: 48.4, lon: 11.8 }, PRG: { lat: 50.1, lon: 14.3 },
  FRA: { lat: 50.0, lon: 8.6 }, AMS: { lat: 52.3, lon: 4.8 }, CDG: { lat: 49.0, lon: 2.5 },
  BRU: { lat: 50.9, lon: 4.5 }, ZRH: { lat: 47.5, lon: 8.5 }, CPH: { lat: 55.6, lon: 12.7 },
  OSL: { lat: 60.2, lon: 11.1 }, EDI: { lat: 55.9, lon: -3.4 },
  // Middle East
  DXB: { lat: 25.3, lon: 55.4 }, AUH: { lat: 24.4, lon: 54.7 }, MCT: { lat: 23.6, lon: 58.3 },
  DOH: { lat: 25.3, lon: 51.6 },
  // SE Asia
  BKK: { lat: 13.7, lon: 100.8 }, KUL: { lat: 3.1, lon: 101.7 }, SIN: { lat: 1.4, lon: 104.0 },
  CGK: { lat: -6.1, lon: 106.7 },
  // North America
  LHR: { lat: 51.5, lon: -0.5 }, LGW: { lat: 51.2, lon: -0.2 },
  JFK: { lat: 40.6, lon: -73.8 }, YYZ: { lat: 43.7, lon: -79.4 },
  ORD: { lat: 41.9, lon: -87.9 }, SFO: { lat: 37.6, lon: -122.4 },
  // East Asia
  HKG: { lat: 22.3, lon: 113.9 }, NRT: { lat: 35.8, lon: 140.4 }, ICN: { lat: 37.5, lon: 126.5 },
  // Africa
  JNB: { lat: -26.1, lon: 28.2 }, NBO: { lat: -1.3, lon: 36.9 },
};

export function getAirportCoord(iata) {
  return AIRPORT_COORDS[iata];
}

export async function fetchForecast(lat, lon) {
  const key = `${lat.toFixed(1)},${lon.toFixed(1)}`;
  const cached = cache.get(key);
  if (cached && Date.now() - cached.time < CACHE_TTL_MS) {
    return cached.data;
  }

  try {
    const params = new URLSearchParams({
      latitude: lat.toFixed(2),
      longitude: lon.toFixed(2),
      hourly: 'temperature_2m,wind_speed_10m,wind_direction_10m,precipitation,weather_code,visibility',
      forecast_days: '3',
      timezone: 'auto',
    });

    const res = await fetchWithTimeout(`${BASE_URL}?${params}`, {}, TIMEOUT_MS);
    if (res.ok) {
      const data = await res.json();
      cache.set(key, { data, time: Date.now() });
      return data;
    }
  } catch (err) {
    console.error('[open-meteo] fetch failed:', err.message);
  }

  return null;
}

// WMO weather codes that indicate severe conditions
const SEVERE_WMO_CODES = {
  95: 'thunderstorm_slight', 96: 'thunderstorm_slight_hail', 99: 'thunderstorm_heavy_hail',
  71: 'snow_slight', 73: 'snow_moderate', 75: 'snow_heavy',
  77: 'snow_grains',
  65: 'rain_heavy', 66: 'freezing_rain', 67: 'freezing_rain_heavy',
  45: 'fog', 48: 'fog_rime',
  3: 'overcast', 2: 'partly_cloudy',
};

// Build observations for airports with severe weather in forecast
export async function buildWeatherObservations(airports) {
  const observations = [];

  for (const iata of airports) {
    const coord = AIRPORT_COORDS[iata];
    if (!coord) continue;

    const forecast = await fetchForecast(coord.lat, coord.lon);
    if (!forecast?.hourly) continue;

    const { time, weather_code, wind_speed_10m, precipitation, visibility, temperature_2m } = forecast.hourly;

    // Check next 24 hours for severe conditions
    const now = Date.now();
    let severeWindow = null;

    for (let i = 0; i < Math.min(time.length, 24); i++) {
      const t = new Date(time[i]).getTime();
      if (t < now) continue;

      const wmo = weather_code?.[i];
      const wind = wind_speed_10m?.[i] || 0; // km/h
      const precip = precipitation?.[i] || 0; // mm
      const vis = visibility?.[i] || 10000; // meters
      const temp = temperature_2m?.[i] || 20;

      // Detect severe conditions
      const isThunderstorm = wmo && wmo >= 95;
      const isHeavyRain = wmo && (wmo === 65 || wmo === 66 || wmo === 67) || precip > 10;
      const isHeavySnow = wmo && (wmo === 73 || wmo === 75 || wmo === 77);
      const isFog = wmo && (wmo === 45 || wmo === 48) || vis < 1000;
      const isHighWind = wind > 50; // > 50 km/h ≈ 27 kt
      const isExtremeHeat = temp > 45;
      const isExtremeCold = temp < -20;

      if (isThunderstorm || isHeavyRain || isHeavySnow || isFog || isHighWind || isExtremeHeat || isExtremeCold) {
        severeWindow = {
          time: time[i],
          wmo,
          wind,
          precip,
          vis,
          temp,
          condition: isThunderstorm ? 'thunderstorm' :
                     isHeavySnow ? 'heavy_snow' :
                     isHeavyRain ? 'heavy_rain' :
                     isFog ? 'fog' :
                     isHighWind ? 'high_wind' :
                     isExtremeHeat ? 'extreme_heat' : 'extreme_cold',
        };
        break; // first severe window is enough
      }
    }

    if (!severeWindow) continue;

    const severityMap = {
      thunderstorm: { sev: 'high', val: 75, hazard: 'thunderstorm' },
      heavy_snow: { sev: 'high', val: 70, hazard: 'snow' },
      heavy_rain: { sev: 'moderate', val: 55, hazard: 'heavy_rain' },
      fog: { sev: 'moderate', val: 50, hazard: 'fog' },
      high_wind: { sev: 'high', val: 72, hazard: 'high_wind' },
      extreme_heat: { sev: 'moderate', val: 48, hazard: 'extreme_heat' },
      extreme_cold: { sev: 'moderate', val: 45, hazard: 'extreme_cold' },
    };

    const sm = severityMap[severeWindow.condition];

    observations.push({
      signalId: `ometeo-${iata}-${severeWindow.condition}-${Date.now()}`,
      detected: new Date().toISOString(),
      name: `${iata} ${severeWindow.condition.replace(/_/g, ' ')} forecast`,
      hazardType: sm.hazard,
      geo: { lat: coord.lat, lon: coord.lon, radiusKm: 80 },
      airports: [iata],
      airspace: [],
      summary: `${iata}: ${severeWindow.condition.replace(/_/g, ' ')} expected at ${severeWindow.time}. Wind ${severeWindow.wind} km/h, precip ${severeWindow.precip} mm, vis ${severeWindow.vis} m`,
      factorHints: {
        probability: 70,
        severity: sm.val,
        geographicReach: 35,
        expectedDuration: 50,
        timeToImpact: 65,
        escalationRate: 40,
        sourceCredibility: 80, // Open-Meteo (ECMWF/GFS models)
        predictionConfidence: 65,
      },
      domains: ['Airport operations', 'Flight schedule'],
      preliminaryEffects: [
        { ord: 1, title: `${severeWindow.condition.replace(/_/g, ' ')} at ${iata}`, lead: '0–6h' },
      ],
      evidence: [{
        source: 'Open-Meteo (ECMWF/GFS model data)',
        tier: 1,
        role: 'Forecast model source',
        timestamp: new Date().toISOString(),
        excerpt: `Forecast: ${severeWindow.condition}, wind ${severeWindow.wind} km/h, vis ${severeWindow.vis} m`,
        url: `https://open-meteo.com/`,
      }],
      rawRefs: [`ometeo-${iata}-${Date.now()}`],
      dataSourceMode: 'real',
    });
  }

  return observations;
}

export default { fetchForecast, buildWeatherObservations, getAirportCoord };

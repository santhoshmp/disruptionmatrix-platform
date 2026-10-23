// real-airline-registry.js — Real airline metadata for impact assessment
// Uses real airline data from OpenFlights + known hub/network structure.
// Since we don't have real schedule data, we approximate network share and
// movements based on known airline operations at major airports.
//
// Phase 2 migration: AIRLINE_HUBS and AIRLINE_FLEET_CAPS now read from the
// DB-backed reference loader when available, falling back to the hardcoded
// consts below. The registry is rebuilt lazily on first access so it can
// pick up DB-loaded data (the loader loads asynchronously on startup).

import { getAllAirlines as getAllAirlinesData, getAllAirports } from './airport-airline-data.js';
import * as refLoader from './reference-loader.js';

// ── Real airline hub mapping (IATA → primary hub airports) ──────────
// Based on public knowledge of each airline's main base of operations.

const AIRLINE_HUBS = {
  // India
  '6E': { primary: 'DEL', secondary: ['BOM', 'BLR', 'MAA'], country: 'India', name: 'IndiGo' },
  'AI': { primary: 'DEL', secondary: ['BOM', 'BLR'], country: 'India', name: 'Air India' },
  'SG': { primary: 'DEL', secondary: ['BOM', 'HYD'], country: 'India', name: 'SpiceJet' },
  'UK': { primary: 'DEL', secondary: ['BOM', 'BLR'], country: 'India', name: 'Vistara' },
  'IX': { primary: 'COK', secondary: ['DEL', 'BLR'], country: 'India', name: 'Air India Express' },
  'QP': { primary: 'BOM', secondary: ['BLR', 'DEL'], country: 'India', name: 'Akasa Air' },
  // Europe
  'LH': { primary: 'FRA', secondary: ['MUC'], country: 'Germany', name: 'Lufthansa' },
  'AF': { primary: 'CDG', secondary: [], country: 'France', name: 'Air France' },
  'KL': { primary: 'AMS', secondary: [], country: 'Netherlands', name: 'KLM' },
  'BA': { primary: 'LHR', secondary: ['LGW'], country: 'United Kingdom', name: 'British Airways' },
  'LX': { primary: 'ZRH', secondary: ['GVA'], country: 'Switzerland', name: 'Swiss International Air Lines' },
  'OS': { primary: 'VIE', secondary: [], country: 'Austria', name: 'Austrian Airlines' },
  'SN': { primary: 'BRU', secondary: [], country: 'Belgium', name: 'Brussels Airlines' },
  'AZ': { primary: 'FCO', secondary: [], country: 'Italy', name: 'ITA Airways' },
  'IB': { primary: 'MAD', secondary: [], country: 'Spain', name: 'Iberia' },
  'SK': { primary: 'CPH', secondary: ['OSL'], country: 'Sweden', name: 'SAS' },
  'DY': { primary: 'OSL', secondary: [], country: 'Norway', name: 'Norwegian Air Shuttle' },
  'LO': { primary: 'WAW', secondary: [], country: 'Poland', name: 'LOT Polish Airlines' },
  'TK': { primary: 'IST', secondary: [], country: 'Turkey', name: 'Turkish Airlines' },
  'W6': { primary: 'BUD', secondary: [], country: 'Hungary', name: 'Wizz Air' },
  'FR': { primary: 'DUB', secondary: ['STN'], country: 'Ireland', name: 'Ryanair' },
  'U2': { primary: 'LGW', secondary: [], country: 'United Kingdom', name: 'easyJet' },
  'EW': { primary: 'MUC', secondary: [], country: 'Germany', name: 'Eurowings' },
  // Middle East
  'EK': { primary: 'DXB', secondary: [], country: 'United Arab Emirates', name: 'Emirates' },
  'EY': { primary: 'AUH', secondary: [], country: 'United Arab Emirates', name: 'Etihad Airways' },
  'QR': { primary: 'DOH', secondary: [], country: 'Qatar', name: 'Qatar Airways' },
  'WY': { primary: 'MCT', secondary: [], country: 'Oman', name: 'Oman Air' },
  'GF': { primary: 'BAH', secondary: [], country: 'Bahrain', name: 'Gulf Air' },
  'SV': { primary: 'RUH', secondary: ['JED'], country: 'Saudi Arabia', name: 'Saudia' },
  'KU': { primary: 'KWI', secondary: [], country: 'Kuwait', name: 'Kuwait Airways' },
  'RJ': { primary: 'AMM', secondary: [], country: 'Jordan', name: 'Royal Jordanian' },
  'LY': { primary: 'TLV', secondary: [], country: 'Israel', name: 'EL AL Israel Airlines' },
  // Southeast Asia
  'SQ': { primary: 'SIN', secondary: [], country: 'Singapore', name: 'Singapore Airlines' },
  'TG': { primary: 'BKK', secondary: [], country: 'Thailand', name: 'Thai Airways' },
  'MH': { primary: 'KUL', secondary: [], country: 'Malaysia', name: 'Malaysia Airlines' },
  'AK': { primary: 'KUL', secondary: ['BKK'], country: 'Malaysia', name: 'AirAsia' },
  'GA': { primary: 'CGK', secondary: [], country: 'Indonesia', name: 'Garuda Indonesia' },
  'PR': { primary: 'MNL', secondary: [], country: 'Philippines', name: 'Philippine Airlines' },
  '5J': { primary: 'MNL', secondary: [], country: 'Philippines', name: 'Cebu Pacific' },
  'VN': { primary: 'HAN', secondary: ['SGN'], country: 'Vietnam', name: 'Vietnam Airlines' },
  'VJ': { primary: 'SGN', secondary: [], country: 'Vietnam', name: 'VietJet Air' },
  // North America
  'AA': { primary: 'JFK', secondary: ['ORD', 'LAX'], country: 'United States', name: 'American Airlines' },
  'DL': { primary: 'JFK', secondary: ['ATL'], country: 'United States', name: 'Delta Air Lines' },
  'UA': { primary: 'EWR', secondary: ['ORD', 'SFO'], country: 'United States', name: 'United Airlines' },
  'WN': { primary: 'ATL', secondary: [], country: 'United States', name: 'Southwest Airlines' },
  'B6': { primary: 'JFK', secondary: ['BOS'], country: 'United States', name: 'JetBlue Airways' },
  'AC': { primary: 'YYZ', secondary: [], country: 'Canada', name: 'Air Canada' },
  'WS': { primary: 'YYZ', secondary: [], country: 'Canada', name: 'WestJet' },
  // East Asia
  'CX': { primary: 'HKG', secondary: [], country: 'Hong Kong', name: 'Cathay Pacific' },
  'JL': { primary: 'NRT', secondary: ['HND'], country: 'Japan', name: 'Japan Airlines' },
  'NH': { primary: 'HND', secondary: ['NRT'], country: 'Japan', name: 'All Nippon Airways' },
  'KE': { primary: 'ICN', secondary: [], country: 'South Korea', name: 'Korean Air' },
  'OZ': { primary: 'ICN', secondary: [], country: 'South Korea', name: 'Asiana Airlines' },
  'CZ': { primary: 'CAN', secondary: ['PEK'], country: 'China', name: 'China Southern Airlines' },
  'CA': { primary: 'PEK', secondary: [], country: 'China', name: 'Air China' },
  'MU': { primary: 'PVG', secondary: [], country: 'China', name: 'China Eastern Airlines' },
  'BR': { primary: 'TPE', secondary: [], country: 'Taiwan', name: 'EVA Air' },
  'CI': { primary: 'TPE', secondary: [], country: 'Taiwan', name: 'China Airlines' },
  // Africa
  'SA': { primary: 'JNB', secondary: ['CPT'], country: 'South Africa', name: 'South African Airways' },
  'FA': { primary: 'JNB', secondary: ['CPT'], country: 'South Africa', name: 'FlySafair' },
  'KQ': { primary: 'NBO', secondary: [], country: 'Kenya', name: 'Kenya Airways' },
  'ET': { primary: 'ADD', secondary: [], country: 'Ethiopia', name: 'Ethiopian Airlines' },
  'MS': { primary: 'CAI', secondary: [], country: 'Egypt', name: 'EgyptAir' },
  // Oceania
  'QF': { primary: 'SYD', secondary: ['MEL'], country: 'Australia', name: 'Qantas' },
  'NZ': { primary: 'AKL', secondary: [], country: 'New Zealand', name: 'Air New Zealand' },
  // South America
  'LA': { primary: 'SCL', secondary: ['GRU', 'EZE', 'BOG'], country: 'Chile', name: 'LATAM Airlines' },
  'AV': { primary: 'BOG', secondary: [], country: 'Colombia', name: 'Avianca' },
  'G3': { primary: 'GRU', secondary: ['CGH'], country: 'Brazil', name: 'GOL Linhas Aereas' },
  'AR': { primary: 'EZE', secondary: ['AEP'], country: 'Argentina', name: 'Aerolineas Argentinas' },
  'AD': { primary: 'GRU', secondary: ['CNF'], country: 'Brazil', name: 'Azul Brazilian Airlines' },
  'JA': { primary: 'SCL', secondary: ['EZE'], country: 'Chile', name: 'JetSMART' },
  'JJ': { primary: 'GRU', secondary: [], country: 'Brazil', name: 'LATAM Airlines Brasil' },
};

// ── Approximate network share per airport ────────────────────────────
// Since we don't have real schedule data, we estimate network share based on:
// - If airport is primary hub: 25-40% share
// - If airport is secondary hub: 10-20% share
// - If airport is in the airline's country: 3-8% share
// - Otherwise: 1-3% share (international service)

const HUB_SHARE = { primary: 35, secondary: 15, focus_city: 8, outstation: 3 };
const COUNTRY_SHARE = 5; // domestic airline at domestic airport
const INTERNATIONAL_SHARE = 2; // international airline at outstation

// ── Approximate fleet capabilities ───────────────────────────────────
// Major carriers typically have CAT III capability on most of their fleet.
// Low-cost carriers may have partial CAT III equipage.

const AIRLINE_FLEET_CAPS = {
  // Full CAT III capability
  'AI': true, 'UK': true, 'LH': true, 'AF': true, 'KL': true, 'BA': true, 'LX': true,
  'OS': true, 'SN': true, 'AZ': true, 'IB': true, 'SK': true, 'LO': true, 'TK': true,
  'EK': true, 'EY': true, 'QR': true, 'WY': true, 'SV': true, 'KU': true, 'RJ': true,
  'LY': true, 'SQ': true, 'TG': true, 'MH': true, 'GA': true, 'PR': true, 'VN': true,
  'AA': true, 'DL': true, 'UA': true, 'AC': true, 'WS': true,
  'CX': true, 'JL': true, 'NH': true, 'KE': true, 'OZ': true, 'CZ': true, 'CA': true,
  'MU': true, 'BR': true, 'CI': true, 'SA': true, 'KQ': true, 'ET': true, 'MS': true,
  'QF': true, 'NZ': true, 'IX': true,
  // Partial / likely CAT III (newer fleets)
  '6E': true, 'QP': true, 'EW': true,
  // Uncertain / likely partial
  'SG': false, 'AK': false, '5J': false, 'VJ': false, 'WN': false, 'B6': true,
  'DY': true, 'W6': true, 'FR': true, 'U2': true, 'FA': false,
};

// ── Build real airline registry ─────────────────────────────────────

function _buildRegistry() {
  const realAirlines = getAllAirlinesData().filter((a) => a.active);
  const registry = [];

  for (const airline of realAirlines) {
    // Phase 2: try DB-backed hub info first, fall back to hardcoded AIRLINE_HUBS
    let hubInfo = refLoader.getAirlineHubs(airline.iata);
    if (hubInfo) {
      hubInfo = {
        primary: hubInfo.primary,
        secondary: hubInfo.secondary || [],
        country: airline.country,
        name: airline.name,
      };
    } else {
      hubInfo = AIRLINE_HUBS[airline.iata];
    }
    if (!hubInfo) continue; // skip airlines without hub data

    const allHubs = [hubInfo.primary, ...(hubInfo.secondary || [])];

    // Build network share map for all airports in our dataset
    const networkShare = {};
    const allAirports = getAllAirportsFromData();
    for (const apt of allAirports) {
      if (apt.iata === hubInfo.primary) {
        networkShare[apt.iata] = HUB_SHARE.primary;
      } else if (hubInfo.secondary?.includes(apt.iata)) {
        networkShare[apt.iata] = HUB_SHARE.secondary;
      } else if (apt.country === hubInfo.country) {
        networkShare[apt.iata] = COUNTRY_SHARE;
      } else {
        // International service — only major airports
        if (apt.scheduled) {
          networkShare[apt.iata] = INTERNATIONAL_SHARE;
        }
      }
    }

    // Phase 2: try DB-backed CAT3 capability first, fall back to hardcoded AIRLINE_FLEET_CAPS
    const cat3FromDb = refLoader.getAirlineCat3(airline.iata);
    const cat3Capable = cat3FromDb != null ? cat3FromDb : !!AIRLINE_FLEET_CAPS[airline.iata];

    registry.push({
      key: airline.iata,
      name: airline.name,
      code: airline.iata,
      icao: airline.icao,
      country: airline.country,
      hub: hubInfo.primary,
      secondaryHub: hubInfo.secondary?.[0] || null,
      hubs: allHubs,
      dailyDepartures: _estimateDailyDepartures(airline.iata),
      networkShare,
      bankStructure: _estimateBankStructure(airline.iata),
      fleetCapabilities: {
        cat3Count: cat3Capable ? 100 : 0,
        cat3Total: 100,
        etops: true,
      },
    });
  }

  return registry;
}

function getAllAirportsFromData() {
  return getAllAirports();
}

function _estimateDailyDepartures(iata) {
  // Rough estimates based on airline size
  const estimates = {
    '6E': 1800, 'AI': 400, 'SG': 300, 'UK': 200, 'IX': 150, 'QP': 100,
    'LH': 300, 'AF': 250, 'KL': 200, 'BA': 250, 'LX': 100, 'OS': 80, 'SN': 60,
    'AZ': 150, 'IB': 200, 'SK': 150, 'DY': 100, 'LO': 80, 'TK': 400,
    'W6': 150, 'FR': 400, 'U2': 300, 'EW': 150,
    'EK': 250, 'EY': 100, 'QR': 200, 'WY': 60, 'GF': 50, 'SV': 200,
    'KU': 50, 'RJ': 50, 'LY': 40,
    'SQ': 150, 'TG': 100, 'MH': 80, 'AK': 200, 'GA': 100, 'PR': 60,
    '5J': 150, 'VN': 100, 'VJ': 120,
    'AA': 800, 'DL': 800, 'UA': 700, 'WN': 600, 'B6': 200, 'AC': 300, 'WS': 150,
    'CX': 150, 'JL': 150, 'NH': 200, 'KE': 120, 'OZ': 100, 'CZ': 300, 'CA': 300, 'MU': 300,
    'BR': 80, 'CI': 60,
    'SA': 50, 'FA': 80, 'KQ': 40, 'ET': 100, 'MS': 80,
    'QF': 200, 'NZ': 80,
  };
  return estimates[iata] || 50;
}

function _estimateBankStructure(iata) {
  // Major airlines typically have morning and evening banks
  return [
    { name: 'Morning Bank', time: '06:00-09:00', sensitivity: 'critical' },
    { name: 'Midday Bank', time: '12:00-15:00', sensitivity: 'high' },
    { name: 'Evening Bank', time: '17:00-20:00', sensitivity: 'critical' },
  ];
}

// ── Build the registry ───────────────────────────────────────────────
// Phase 2: registry is built lazily on first access so it can use DB-loaded
// airline data from the reference loader (which loads asynchronously on startup).

let _registry = null;
let _airlineByKey = null;
let _airlineByCode = null;

function _ensureRegistry() {
  if (_registry) return;
  _registry = _buildRegistry();
  _airlineByKey = Object.fromEntries(_registry.map((a) => [a.key, a]));
  _airlineByCode = Object.fromEntries(_registry.map((a) => [a.code, a]));
}

// ── API (same interface as airline-registry.js) ──────────────────────

export function getAirline(key) {
  _ensureRegistry();
  return _airlineByKey[key] || null;
}

export function getAirlineByCode(code) {
  _ensureRegistry();
  return _airlineByCode[code] || null;
}

export function getAllAirlines() {
  _ensureRegistry();
  return _registry;
}

export function getAirlinesAtAirport(airportIATA) {
  _ensureRegistry();
  return _registry.filter((a) => a.networkShare && a.networkShare[airportIATA] != null && a.networkShare[airportIATA] > 0);
}

export function getNetworkShare(airlineKey, airportIATA) {
  _ensureRegistry();
  const airline = _airlineByKey[airlineKey];
  if (!airline || !airline.networkShare) return 0;
  return airline.networkShare[airportIATA] || 0;
}

export function getHubRole(airlineKey, airportIATA) {
  _ensureRegistry();
  const airline = _airlineByKey[airlineKey];
  if (!airline) return 'outstation';
  if (airline.hub === airportIATA) return 'primary';
  if (airline.secondaryHub === airportIATA) return 'secondary';
  if (airline.hubs && airline.hubs.includes(airportIATA)) return 'secondary';
  if (airline.networkShare && airline.networkShare[airportIATA] >= 8) return 'focus_city';
  return 'outstation';
}

export function getBankStructure(airlineKey) {
  _ensureRegistry();
  const airline = _airlineByKey[airlineKey];
  return airline?.bankStructure || [];
}

export function getFleetCapabilities(airlineKey) {
  _ensureRegistry();
  const airline = _airlineByKey[airlineKey];
  return airline?.fleetCapabilities || { cat3Count: 0, cat3Total: 0, etops: false };
}

export function hasCat3Capability(airlineKey) {
  _ensureRegistry();
  const caps = getFleetCapabilities(airlineKey);
  return caps.cat3Count > 0 && caps.cat3Count >= caps.cat3Total * 0.8;
}

export default {
  getAirline,
  getAirlineByCode,
  getAllAirlines,
  getAirlinesAtAirport,
  getNetworkShare,
  getHubRole,
  getBankStructure,
  getFleetCapabilities,
  hasCat3Capability,
};

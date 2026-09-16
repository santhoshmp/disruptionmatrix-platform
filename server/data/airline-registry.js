// airline-registry.js — Airline metadata loaded from agent-config.json
// Provides hub, fleet, bank structure, fleet capabilities, and network share data.

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');

const config = JSON.parse(readFileSync(join(ROOT, 'src', 'data', 'agent-config.json'), 'utf-8'));

// Extract the airline registry from the impact-assessment agent type config
const impactType = config.agentTypes.find((t) => t.type === 'impact-assessment');
const AIRLINES = impactType?.airlineRegistry || [];

// Build lookup maps
const AIRLINE_BY_KEY = Object.fromEntries(AIRLINES.map((a) => [a.key, a]));
const AIRLINE_BY_CODE = Object.fromEntries(AIRLINES.map((a) => [a.code, a]));

// ── API ─────────────────────────────────────────────────────────────

export function getAirline(key) {
  return AIRLINE_BY_KEY[key] || null;
}

export function getAirlineByCode(code) {
  return AIRLINE_BY_CODE[code] || null;
}

export function getAllAirlines() {
  return AIRLINES;
}

// Get airlines that operate at a given airport (based on network share)
export function getAirlinesAtAirport(airportIATA) {
  return AIRLINES.filter((a) => a.networkShare && a.networkShare[airportIATA] != null);
}

// Get airline's network share at a given airport (percentage)
export function getNetworkShare(airlineKey, airportIATA) {
  const airline = getAirline(airlineKey);
  if (!airline || !airline.networkShare) return 0;
  return airline.networkShare[airportIATA] || 0;
}

// Check if an airport is an airline's hub
export function getHubRole(airlineKey, airportIATA) {
  const airline = getAirline(airlineKey);
  if (!airline) return 'outstation';
  if (airline.hub === airportIATA) return 'primary';
  if (airline.secondaryHub === airportIATA) return 'secondary';
  if (airline.hubs && airline.hubs.includes(airportIATA)) return 'hub';
  if (airline.networkShare && airline.networkShare[airportIATA] >= 10) return 'focus_city';
  return 'outstation';
}

// Get airline's bank structure
export function getBankStructure(airlineKey) {
  const airline = getAirline(airlineKey);
  return airline?.bankStructure || [];
}

// Get airline's fleet capabilities
export function getFleetCapabilities(airlineKey) {
  const airline = getAirline(airlineKey);
  return airline?.fleetCapabilities || { cat3Count: 0, cat3Total: 0, etops: false };
}

// Check if airline has CAT III capability (for fog/low visibility events)
export function hasCat3Capability(airlineKey) {
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

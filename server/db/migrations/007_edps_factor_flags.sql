-- 007_edps_factor_flags.sql — EDPS factor enable/disable + self-documentation
-- Adds `active` (whether the factor contributes to the score) and
-- `description` (how the factor is derived — shown in Admin → Threat Profile).

ALTER TABLE ref_edps_factors
  ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS description TEXT;

UPDATE ref_edps_factors SET description = 'How likely the event is to occur or persist. Derived from source corroboration (multiple independent signals raise it) and forecast confidence.' WHERE key = 'probability';
UPDATE ref_edps_factors SET description = 'How severe the operational impact would be if the event fully materialises. Set from the hazard type''s historical impact profile (e.g. an airspace closure scores higher than fog).' WHERE key = 'severity';
UPDATE ref_edps_factors SET description = 'How many airports / how large an area is affected. Derived from the affected-airport count and the signal''s geo radius (≥3 airports ≈ 70+, 2 ≈ 50+, 1 below).' WHERE key = 'geographicReach';
UPDATE ref_edps_factors SET description = 'How long the disruption is expected to last. Mapped from the source''s forecast window (e.g. TAF validity) or the hazard family''s typical duration.' WHERE key = 'expectedDuration';
UPDATE ref_edps_factors SET description = 'How soon the first operational effect is expected. A high value means imminent (~30 min); a low value means up to ~48 h out. Shown on the board as TTI.' WHERE key = 'timeToImpact';
UPDATE ref_edps_factors SET description = 'Whether the situation is worsening, stable or improving. Derived from score movement on update and the hazard''s typical progression.' WHERE key = 'escalationRate';
UPDATE ref_edps_factors SET description = 'Trust in the reporting source, from the source-tier classification: Tier 1 official (NOAA, FAA, OPSGROUP) ≈ 80+, Tier 2 corroborating (GDELT, news) ≈ 60, Tier 3 social ≈ lower.' WHERE key = 'sourceCredibility';
UPDATE ref_edps_factors SET description = 'Confidence in the assessment itself — agreement between independent signals and forecast spread. News-only signals stay moderate; multi-source events score higher.' WHERE key = 'predictionConfidence';

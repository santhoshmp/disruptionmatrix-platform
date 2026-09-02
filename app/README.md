# DisruptionMatrix — Interactive Prototype (React)

Interactive proof-of-concept for **DisruptionMatrix**, an external threat-intelligence platform, demoed against the synthetic airline **Namma Air** (see `../docs/namma-air-synthetic-airline-design.md`).

## Views

| Route | View | Lens |
|---|---|---|
| `/` | Home / view chooser | — |
| `/board` | Active threat board (ranked list + escalation lanes) | Global |
| `/event/:id` | Event detail — assessment, escalation & response, SOP, retrospective | Global |
| `/map` | World threat map (Leaflet) | Global |
| `/radar` | Namma Air threat radar — five-tier exposure model | Airline |
| `/airline-map` | Namma Air network map with flagged rotations | Airline |
| `/explorer` | Data explorer — tables + schedule Gantt with recovery solver | Airline |

## Architecture

- **Vite + React 18**, `react-router-dom` (hash routing), **Leaflet** for maps
- **Data**: static JSON in `src/data/` — `dm-data.json` (global events, SOPs, escalation model), `namma-data.json` (airline threats, exposure, flights, fleet, crew, pairings), `geo.json` (coordinates). Designed to be swapped for an API later.
- **Theme**: dark/light via CSS variables (`src/styles.css`), shared color helpers in `src/theme.js`
- No backend — all state is client-side; the recovery solver is a deterministic rule set (`SOLVER_RULES` in `DataExplorer.jsx`).

## Run

```bash
npm install
npm run dev
```

Open http://localhost:5173

All names, codes, routes and figures are fictional, for demonstration purposes only.

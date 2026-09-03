import NAMMA from './data/namma-data.json';
import EVA from './data/eurovista-data.json';
import ICA from './data/indiconnect-data.json';

export const AIRLINES = {
  namma: {
    key: 'namma',
    name: 'Namma Air',
    shortName: 'Namma Air',
    code: 'N7',
    icao: 'NMA',
    callsign: 'NAMMA',
    hub: 'BLR',
    hubName: 'Bengaluru',
    secondaryHub: 'DEL',
    hubs: ['BLR', 'DEL'],
    accent: '#22D3EE',
    scoreField: 'namma',
    scoreLabel: 'NAMMA SCORE',
    occLabel: 'OPERATIONS CONTROL CENTRE — BLR',
    radarTitle: 'Namma Air — Operations Threat Radar',
    radarSub: "External intelligence fused with the airline's own five-tier exposure model · BLR hub · DEL node",
    bankLabel: 'BLR BANK STRUCTURE · DISRUPTION-SENSITIVE SKELETON',
    mapCenter: [20, 78],
    mapZoom: 4,
    routePrefix: '',
    data: NAMMA
  },
  eva: {
    key: 'eva',
    name: 'EuroVista Airways',
    shortName: 'EuroVista',
    code: 'EV',
    icao: 'EVA',
    callsign: 'EUROVISTA',
    hub: 'VIE',
    hubName: 'Vienna',
    secondaryHub: 'MUC',
    hubs: ['VIE', 'MUC'],
    accent: '#A78BFA',
    scoreField: 'eva',
    scoreLabel: 'EUROVISTA SCORE',
    occLabel: 'OPERATIONS CONTROL CENTRE — VIE',
    radarTitle: 'EuroVista Airways — Operations Threat Radar',
    radarSub: "External intelligence fused with EuroVista's five-tier exposure model · VIE hub · MUC/ZRH/PRG bases",
    bankLabel: 'VIE BANK STRUCTURE · DISRUPTION-SENSITIVE SKELETON',
    mapCenter: [48, 14],
    mapZoom: 4,
    routePrefix: '/eva',
    data: EVA
  },
  ica: {
    key: 'ica',
    name: 'IndiConnect Airways',
    shortName: 'IndiConnect',
    code: 'IC',
    icao: 'INC',
    callsign: 'INDICONNECT',
    hub: 'DEL',
    hubName: 'Delhi',
    secondaryHub: 'BOM',
    hubs: ['DEL', 'BOM'],
    accent: '#F59E2B',
    scoreField: 'ica',
    scoreLabel: 'INDICONNECT SCORE',
    occLabel: 'OPERATIONS CONTROL CENTRE — DEL',
    radarTitle: 'IndiConnect Airways — Operations Threat Radar',
    radarSub: "External intelligence fused with IndiConnect's five-tier exposure model · DEL hub · BOM/BLR bases",
    bankLabel: 'DEL BANK STRUCTURE · DISRUPTION-SENSITIVE SKELETON',
    mapCenter: [22, 78],
    mapZoom: 4,
    routePrefix: '/ica',
    data: ICA
  }
};

export function getAirline(key) {
  return AIRLINES[key] || AIRLINES.namma;
}

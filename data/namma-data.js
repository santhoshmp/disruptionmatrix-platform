// Namma Air Operations Threat Radar — synthetic PoC dataset
(function () {
  var THREATS = [
    { id: 'monsoon', name: 'Bay of Bengal Monsoon Depression', cat: 'Weather', code: 'WX', region: 'Bay of Bengal → South/East India', edps: 84, namma: 87, traj: 'Escalating', tti: '10h',
      summary: 'Deepening low-pressure system tracking toward the southeast coast. Heavy rain and low-level wind shear forecast over BLR and Chennai approach corridors through the evening bank.' },
    { id: 'fuel', name: 'BLR Fuel Depot Supply Disruption', cat: 'Infrastructure', code: 'INF', region: 'Bengaluru (BLR)', edps: 68, namma: 74, traj: 'Escalating', tti: '6h',
      summary: 'Primary into-plane fuel supplier at BLR reports a pipeline valve fault reducing uplift rate by ~40%. Secondary supplier has limited hydrant access. Namma Air sources over 90% of BLR uplift from the affected supplier.' },
    { id: 'delfog', name: 'Delhi Winter Fog — CAT III Demand Surge', cat: 'Weather', code: 'WX', region: 'Delhi (DEL)', edps: 76, namma: 69, traj: 'Stable', tti: '14h',
      summary: 'Dense fog advisory for DEL with visibility below 200m expected overnight. CAT IIIB approach capability required; Namma Air fleet certification is split.' },
    { id: 'chnAtc', name: 'Chennai ACC Flow Restriction', cat: 'ATC / Airspace', code: 'ATC', region: 'Chennai FIR (VOMF)', edps: 71, namma: 58, traj: 'Stable', tti: '4h',
      summary: 'Reduced sector capacity in Chennai ACC following an equipment fault. Flow control affects southbound departures from BLR.' },
    { id: 'gulf', name: 'Gulf Airspace Overflight Restriction', cat: 'Geopolitical', code: 'GEO', region: 'Iran / Gulf corridor (LHR sectors)', edps: 62, namma: 55, traj: 'Stable', tti: '2d',
      summary: 'Reserved airspace block over the Gulf corridor narrows the standard BLR–LHR overflight routing, adding distance and fuel burn on affected A350 sectors.' },
    { id: 'cabincrew', name: 'Cabin Crew Go-Slow Notice — DEL Base', cat: 'Industrial action', code: 'IND', region: 'Delhi (DEL)', edps: 45, namma: 41, traj: 'Improving', tti: '3d',
      summary: 'DEL-based cabin crew union has issued a go-slow notice over a rostering grievance. No strike date named; local action risk only.' }
  ];

  var EXPOSURE = {
    monsoon: {
      tier0: { label: 'Schedule / fleet exposure', banks: ['Bank 3 (Evening feed)', 'Bank 4 (Long-haul departure)'], routeCount: 18, note: '18 BLR departures scheduled inside the forecast window, concentrated in the Bank 3 evening feed.' },
      tier1: { label: 'Tail / rotation chains at risk', tails: ['VT-N21', 'VT-N24', 'VT-N26', 'VT-N28', 'VT-N30'], count: 5, note: '5 A350 rotations affected — all routed through the Bank 3 → Bank 4 connection.' },
      tier2: { label: 'Crew pairings near duty limits', pairings: ['BLR-4471', 'BLR-4488', 'BLR-4502'], count: 3, note: '3 crew pairings within 45 minutes of FDP limits if Bank 3 arrival slips beyond 30 minutes.' },
      tier3: { label: 'Connecting pax / cargo exposure', pax: 1400, cargo: 22, note: '~1,400 connecting passengers routed through the Bank 3 → Bank 4 long-haul wave; 22t of transfer cargo on the same connection.' },
      tier4: { label: 'Station dependency & escalation', esc: 4, note: 'BLR is the only hub station in the network — no alternate long-haul gateway. VP escalation threshold crossed at 21:30 IST.' }
    },
    fuel: {
      tier0: { label: 'Schedule / fleet exposure', banks: ['Bank 1', 'Bank 2', 'Bank 3', 'Bank 4'], routeCount: 30, note: 'All four banks draw from the affected depot; reduced uplift rate risks a fleet-wide tankering decision.' },
      tier1: { label: 'Tail / rotation chains at risk', tails: ['VT-N08', 'VT-N12', 'VT-N15', 'VT-N33', 'VT-N35', 'VT-N36'], count: 6, note: '6 rotations flagged for reduced-uplift refuelling, including both A350s on the Bank 4 long-haul wave.' },
      tier2: { label: 'Crew pairings near duty limits', pairings: ['BLR-4460'], count: 1, note: '1 pairing at risk if turnaround extends past the reduced-uplift refuelling window.' },
      tier3: { label: 'Connecting pax / cargo exposure', pax: 260, cargo: 6, note: '260 pax on rotations most likely to see reduced tankering and a possible technical stop.' },
      tier4: { label: 'Station dependency & escalation', esc: 3, note: 'Single-supplier dependency at BLR — secondary supplier has hydrant access to only 2 of 8 gates. Duty manager assessment opened.' }
    },
    delfog: {
      tier0: { label: 'Schedule / fleet exposure', banks: ['DEL secondary node'], routeCount: 8, note: '8 DEL movements inside the fog window, including the DEL–LHR direct A350 service.' },
      tier1: { label: 'Tail / rotation chains at risk', tails: ['VT-N22'], count: 1, note: 'Only 2 of 6 A350s (VT-N22, VT-N33) and 9 of 24 A320neo carry current CAT IIIB certification — VT-N22 is on this rotation; the DEL crew base has no CAT IIIB-rated aircraft of its own.' },
      tier2: { label: 'Crew pairings near duty limits', pairings: ['DEL-2211', 'DEL-2219'], count: 2, note: '2 DEL-based pairings would exceed duty limits if diversion to a non-fog alternate is required.' },
      tier3: { label: 'Connecting pax / cargo exposure', pax: 410, cargo: 9, note: '410 pax connecting onto the DEL–LHR service; 9t of premium cargo with a fixed uplift window.' },
      tier4: { label: 'Station dependency & escalation', esc: 3, note: 'DEL is the only crew sub-base outside BLR — a diversion here has no local recovery crew. Duty manager assessment opened.' }
    },
    chnAtc: {
      tier0: { label: 'Schedule / fleet exposure', banks: ['Bank 2 (Midday)'], routeCount: 6, note: '6 southbound BLR departures subject to flow control through Chennai ACC.' },
      tier1: { label: 'Tail / rotation chains at risk', tails: ['VT-N05', 'VT-N09'], count: 2, note: '2 rotations likely to absorb ATFM delay ahead of the midday bank turnaround.' },
      tier2: { label: 'Crew pairings near duty limits', pairings: [], count: 0, note: 'No pairings currently within margin.' },
      tier3: { label: 'Connecting pax / cargo exposure', pax: 90, cargo: 1, note: '90 pax with same-bank onward connections at BLR.' },
      tier4: { label: 'Station dependency & escalation', esc: 2, note: 'Desk-level watch — reduction is time-boxed to the equipment fault window.' }
    },
    gulf: {
      tier0: { label: 'Schedule / fleet exposure', banks: ['Bank 4 (Long-haul departure)'], routeCount: 4, note: '4 weekly BLR–LHR A350 sectors reroute around the restricted block.' },
      tier1: { label: 'Tail / rotation chains at risk', tails: ['VT-N24', 'VT-N30'], count: 2, note: '2 A350 rotations absorb ~25 minutes added block time and a payload review.' },
      tier2: { label: 'Crew pairings near duty limits', pairings: ['BLR-4495'], count: 1, note: '1 long-haul pairing approaches FDP limit with the added sector time.' },
      tier3: { label: 'Connecting pax / cargo exposure', pax: 180, cargo: 4, note: '180 pax and 4t cargo on the affected LHR sectors; payload review may affect cargo uplift first.' },
      tier4: { label: 'Station dependency & escalation', esc: 2, note: 'Desk-level watch — reroute is a published, standing contingency in the LHR sector plan.' }
    },
    cabincrew: {
      tier0: { label: 'Schedule / fleet exposure', banks: ['DEL secondary node'], routeCount: 5, note: '5 DEL-based rotations crewed from the affected base.' },
      tier1: { label: 'Tail / rotation chains at risk', tails: ['VT-N18'], count: 1, note: '1 rotation flagged if go-slow affects boarding turnaround times.' },
      tier2: { label: 'Crew pairings near duty limits', pairings: [], count: 0, note: 'No duty-margin impact identified.' },
      tier3: { label: 'Connecting pax / cargo exposure', pax: 60, cargo: 0, note: '60 pax on the most exposed rotation.' },
      tier4: { label: 'Station dependency & escalation', esc: 1, note: 'Desk-level watch — no strike date named.' }
    }
  };

  var FLIGHTS = [
    { flt: 'N7-201', route: 'BLR–DEL', tail: 'VT-N05', type: 'A320neo', bank: 'Bank 2', threat: 'chnAtc' },
    { flt: 'N7-214', route: 'BLR–HYD', tail: 'VT-N09', type: 'A320neo', bank: 'Bank 2', threat: 'chnAtc' },
    { flt: 'N7-118', route: 'BLR–BOM', tail: 'VT-N08', type: 'A320neo', bank: 'Bank 1', threat: 'fuel' },
    { flt: 'N7-122', route: 'BLR–GOI', tail: 'VT-N12', type: 'A320neo', bank: 'Bank 1', threat: 'fuel' },
    { flt: 'N7-133', route: 'BLR–COK', tail: 'VT-N15', type: 'A320neo', bank: 'Bank 2', threat: 'fuel' },
    { flt: 'N7-341', route: 'BLR–CCU', tail: 'VT-N21', type: 'A320neo', bank: 'Bank 3', threat: 'monsoon' },
    { flt: 'N7-347', route: 'BLR–HYD', tail: 'VT-N24', type: 'A320neo', bank: 'Bank 3', threat: 'monsoon' },
    { flt: 'N7-352', route: 'BLR–MAA', tail: 'VT-N26', type: 'A320neo', bank: 'Bank 3', threat: 'monsoon' },
    { flt: 'N7-360', route: 'BLR–PNQ', tail: 'VT-N28', type: 'A320neo', bank: 'Bank 3', threat: 'monsoon' },
    { flt: 'N7-372', route: 'BLR–VTZ', tail: 'VT-N30', type: 'A320neo', bank: 'Bank 3', threat: 'monsoon' },
    { flt: 'N7-501', route: 'BLR–LHR', tail: 'VT-N24', type: 'A350-900', bank: 'Bank 4', threat: 'gulf' },
    { flt: 'N7-503', route: 'BLR–LHR', tail: 'VT-N30', type: 'A350-900', bank: 'Bank 4', threat: 'gulf' },
    { flt: 'N7-505', route: 'BLR–JFK (via)', tail: 'VT-N33', type: 'A350-900', bank: 'Bank 4', threat: 'fuel' },
    { flt: 'N7-507', route: 'BLR–SIN', tail: 'VT-N35', type: 'A350-900', bank: 'Bank 4', threat: 'fuel' },
    { flt: 'N7-509', route: 'BLR–DXB', tail: 'VT-N36', type: 'A350-900', bank: 'Bank 4', threat: 'fuel' },
    { flt: 'N7-620', route: 'DEL–LHR', tail: 'VT-N22', type: 'A350-900', bank: 'DEL node', threat: 'delfog' },
    { flt: 'N7-611', route: 'DEL–BLR', tail: 'VT-N29', type: 'A320neo', bank: 'DEL node', threat: 'delfog' },
    { flt: 'N7-615', route: 'DEL–BOM', tail: 'VT-N18', type: 'A320neo', bank: 'DEL node', threat: 'cabincrew' }
  ];

  var PAIRINGS = [
    { id: 'BLR-4471', base: 'BLR', route: 'BLR–CCU–BLR–LHR', margin: 38, status: 'Red', threat: 'monsoon' },
    { id: 'BLR-4488', base: 'BLR', route: 'BLR–MAA–BLR–SIN', margin: 44, status: 'Red', threat: 'monsoon' },
    { id: 'BLR-4502', base: 'BLR', route: 'BLR–PNQ–BLR–DXB', margin: 52, status: 'Amber', threat: 'monsoon' },
    { id: 'BLR-4460', base: 'BLR', route: 'BLR–JFK (via) turnaround', margin: 61, status: 'Amber', threat: 'fuel' },
    { id: 'BLR-4495', base: 'BLR', route: 'BLR–LHR–BLR', margin: 55, status: 'Amber', threat: 'gulf' },
    { id: 'DEL-2211', base: 'DEL', route: 'DEL–LHR standby', margin: 33, status: 'Red', threat: 'delfog' },
    { id: 'DEL-2219', base: 'DEL', route: 'DEL–BOM–DEL', margin: 47, status: 'Amber', threat: 'delfog' },
    { id: 'DEL-2203', base: 'DEL', route: 'DEL–BLR–DEL', margin: 88, status: 'Green', threat: 'cabincrew' }
  ];

  var BANKS = [
    { id: 'b1', label: 'Bank 1', sub: 'Morning feed', window: '05:30–08:30', kind: 'Domestic', severity: 1 },
    { id: 'b2', label: 'Bank 2', sub: 'Midday wave', window: '11:00–14:00', kind: 'Domestic', severity: 2 },
    { id: 'b3', label: 'Bank 3', sub: 'Evening feed → long-haul', window: '17:00–20:00', kind: 'Domestic feed', severity: 4 },
    { id: 'b4', label: 'Bank 4', sub: 'Long-haul departure', window: '22:00–01:00', kind: 'A350 international', severity: 3 },
    { id: 'del', label: 'DEL', sub: 'Secondary node · crew sub-base', window: 'All-day', kind: 'Mixed', severity: 3 }
  ];

  var VULNERABILITIES = [
    { title: 'Bank 3 → Bank 4 connection fragility', detail: 'The evening domestic feed is the sole supply into the long-haul wave — there is no second feed window if Bank 3 slips.' },
    { title: 'Split CAT IIIB capability', detail: 'Only 2 of 6 A350s and 9 of 24 A320neo aircraft carry current CAT IIIB certification, concentrating low-visibility risk on a subset of tails.' },
    { title: 'Single-supplier fuel dependency at BLR', detail: 'Over 90% of BLR into-plane uplift runs through one supplier with no fast-switch secondary hydrant access.' },
    { title: 'LHR overflight corridor exposure', detail: 'BLR–LHR A350 sectors route through a single Gulf corridor with no standing alternate that avoids added block time.' }
  ];

  function spark(base, vol, n) {
    var out = [], v = base;
    for (var i = 0; i < n; i++) { v += (Math.sin(i * 1.3 + base) * vol) + (Math.random() - 0.5) * vol * 0.6; out.push(Math.round(v * 10) / 10); }
    return out;
  }

  var SNAPSHOT = {
    otp: { label: 'On-time performance', value: 78, unit: '%', trend: spark(82, 4, 24), tone: 'amber' },
    delays: { label: 'Active delays', value: 14, unit: '', trend: spark(9, 3, 24), tone: 'amber' },
    aog: { label: 'AOG count', value: 2, unit: '', trend: spark(1.5, 1, 24), tone: 'red' },
    crewAlerts: { label: 'Crew legality alerts', value: 5, unit: '', trend: spark(3, 1.5, 24), tone: 'amber' },
    escalations: { label: 'Active escalations', value: 2, unit: '', trend: spark(1, 0.8, 24), tone: 'red' },
    fuel: { label: 'Fuel status', value: 'Constrained', unit: '', note: '2 of 3 BLR depots', tone: 'amber' },
    catering: { label: 'Catering status', value: 'Normal', unit: '', note: 'All stations', tone: 'green' }
  };


  var FLEET = [
    { tail: 'VT-N01', type: 'A320neo', base: 'BLR', catIIIB: true, status: 'In service' },
    { tail: 'VT-N02', type: 'A320neo', base: 'BLR', catIIIB: false, status: 'In service' },
    { tail: 'VT-N03', type: 'A320neo', base: 'BLR', catIIIB: false, status: 'In service' },
    { tail: 'VT-N04', type: 'A320neo', base: 'BLR', catIIIB: false, status: 'In service' },
    { tail: 'VT-N05', type: 'A320neo', base: 'BLR', catIIIB: true, status: 'In service' },
    { tail: 'VT-N06', type: 'A320neo', base: 'BLR', catIIIB: false, status: 'In service' },
    { tail: 'VT-N07', type: 'A320neo', base: 'BLR', catIIIB: false, status: 'In service' },
    { tail: 'VT-N08', type: 'A320neo', base: 'BLR', catIIIB: true, status: 'In service' },
    { tail: 'VT-N09', type: 'A320neo', base: 'BLR', catIIIB: true, status: 'In service' },
    { tail: 'VT-N10', type: 'A320neo', base: 'BLR', catIIIB: false, status: 'In service' },
    { tail: 'VT-N11', type: 'A320neo', base: 'BLR', catIIIB: false, status: 'In service' },
    { tail: 'VT-N12', type: 'A320neo', base: 'BLR', catIIIB: true, status: 'In service' },
    { tail: 'VT-N13', type: 'A320neo', base: 'BLR', catIIIB: false, status: 'In service' },
    { tail: 'VT-N14', type: 'A320neo', base: 'BLR', catIIIB: false, status: 'Scheduled maintenance' },
    { tail: 'VT-N15', type: 'A320neo', base: 'BLR', catIIIB: true, status: 'In service' },
    { tail: 'VT-N16', type: 'A320neo', base: 'BLR', catIIIB: false, status: 'In service' },
    { tail: 'VT-N17', type: 'A320neo', base: 'BLR', catIIIB: false, status: 'In service' },
    { tail: 'VT-N18', type: 'A320neo', base: 'BLR', catIIIB: true, status: 'In service' },
    { tail: 'VT-N19', type: 'A320neo', base: 'DEL', catIIIB: false, status: 'In service' },
    { tail: 'VT-N20', type: 'A320neo', base: 'DEL', catIIIB: false, status: 'In service' },
    { tail: 'VT-N21', type: 'A320neo', base: 'BLR', catIIIB: true, status: 'In service' },
    { tail: 'VT-N26', type: 'A320neo', base: 'BLR', catIIIB: true, status: 'In service' },
    { tail: 'VT-N28', type: 'A320neo', base: 'DEL', catIIIB: false, status: 'AOG' },
    { tail: 'VT-N29', type: 'A320neo', base: 'DEL', catIIIB: false, status: 'In service' },
    { tail: 'VT-N22', type: 'A350-900', base: 'DEL', catIIIB: true, status: 'In service' },
    { tail: 'VT-N24', type: 'A350-900', base: 'BLR', catIIIB: false, status: 'In service' },
    { tail: 'VT-N30', type: 'A350-900', base: 'BLR', catIIIB: false, status: 'In service' },
    { tail: 'VT-N33', type: 'A350-900', base: 'BLR', catIIIB: true, status: 'AOG' },
    { tail: 'VT-N35', type: 'A350-900', base: 'BLR', catIIIB: false, status: 'In service' },
    { tail: 'VT-N36', type: 'A350-900', base: 'BLR', catIIIB: false, status: 'In service' }
  ];

  var CREW = [
    { id: 'C-1102', name: 'Capt. R. Iyer', rank: 'Captain', base: 'BLR', status: 'On duty', dutyRemaining: 0.6, pairing: 'BLR-4471' },
    { id: 'C-1103', name: 'F/O A. Menon', rank: 'First Officer', base: 'BLR', status: 'On duty', dutyRemaining: 0.6, pairing: 'BLR-4471' },
    { id: 'C-1140', name: 'Capt. S. Rao', rank: 'Captain', base: 'BLR', status: 'On duty', dutyRemaining: 0.7, pairing: 'BLR-4488' },
    { id: 'C-1141', name: 'F/O K. Bhat', rank: 'First Officer', base: 'BLR', status: 'On duty', dutyRemaining: 0.7, pairing: 'BLR-4488' },
    { id: 'C-1178', name: 'Capt. V. Shetty', rank: 'Captain', base: 'BLR', status: 'On duty', dutyRemaining: 0.9, pairing: 'BLR-4502' },
    { id: 'C-1179', name: 'F/O N. Pillai', rank: 'First Officer', base: 'BLR', status: 'On duty', dutyRemaining: 0.9, pairing: 'BLR-4502' },
    { id: 'C-1205', name: 'Capt. D. Kulkarni', rank: 'Captain', base: 'BLR', status: 'Standby', dutyRemaining: 1.0, pairing: 'BLR-4460' },
    { id: 'C-1206', name: 'F/O P. Nair', rank: 'First Officer', base: 'BLR', status: 'Standby', dutyRemaining: 1.0, pairing: 'BLR-4460' },
    { id: 'C-1240', name: 'Capt. M. Chandran', rank: 'Captain', base: 'BLR', status: 'On duty', dutyRemaining: 0.9, pairing: 'BLR-4495' },
    { id: 'C-1241', name: 'F/O S. Reddy', rank: 'First Officer', base: 'BLR', status: 'On duty', dutyRemaining: 0.9, pairing: 'BLR-4495' },
    { id: 'C-2011', name: 'Capt. A. Sharma', rank: 'Captain', base: 'DEL', status: 'Standby', dutyRemaining: 0.55, pairing: 'DEL-2211' },
    { id: 'C-2012', name: 'F/O T. Gupta', rank: 'First Officer', base: 'DEL', status: 'Standby', dutyRemaining: 0.55, pairing: 'DEL-2211' },
    { id: 'C-2044', name: 'Capt. J. Verma', rank: 'Captain', base: 'DEL', status: 'On duty', dutyRemaining: 0.78, pairing: 'DEL-2219' },
    { id: 'C-2045', name: 'F/O H. Kaur', rank: 'First Officer', base: 'DEL', status: 'On duty', dutyRemaining: 0.78, pairing: 'DEL-2219' },
    { id: 'C-2080', name: 'Capt. R. Das', rank: 'Captain', base: 'DEL', status: 'Rest', dutyRemaining: 1.0, pairing: 'DEL-2203' },
    { id: 'C-2081', name: 'Sr. Cabin Crew L. Fernandes', rank: 'Cabin Crew', base: 'DEL', status: 'On duty', dutyRemaining: 0.65, pairing: 'DEL-2203' }
  ];


  var SCHEDULE = {
  "N7-201": { dep: 6, dur: 90 },
  "N7-214": { dep: 6.25, dur: 105 },
  "N7-118": { dep: 6, dur: 100 },
  "N7-122": { dep: 6.4, dur: 95 },
  "N7-133": { dep: 12, dur: 90 },
  "N7-341": { dep: 18, dur: 130 },
  "N7-347": { dep: 18.1, dur: 75 },
  "N7-352": { dep: 18.2, dur: 60 },
  "N7-360": { dep: 18.3, dur: 90 },
  "N7-372": { dep: 18.4, dur: 110 },
  "N7-501": { dep: 22.5, dur: 570 },
  "N7-503": { dep: 22.75, dur: 570 },
  "N7-505": { dep: 22.5, dur: 180 },
  "N7-507": { dep: 23, dur: 240 },
  "N7-509": { dep: 23.25, dur: 240 },
  "N7-620": { dep: 1.5, dur: 540 },
  "N7-611": { dep: 6.5, dur: 150 },
  "N7-615": { dep: 9, dur: 130 },
  };

  window.NAMMA_DATA = { THREATS: THREATS, EXPOSURE: EXPOSURE, FLIGHTS: FLIGHTS, PAIRINGS: PAIRINGS, BANKS: BANKS, VULNERABILITIES: VULNERABILITIES, SNAPSHOT: SNAPSHOT, FLEET: FLEET, CREW: CREW, SCHEDULE: SCHEDULE };
})();

// DisruptionMatrix — synthetic demo dataset (IATA workshop build)
(function () {
  function f(label, val, weight, readout, why) { return { label: label, val: val, weight: weight, readout: readout, why: why }; }

  var DOMAINS = ['Flight schedule', 'Crew', 'Aircraft rotations', 'Airport operations', 'Passengers', 'Cargo', 'Catering', 'Maintenance', 'Regulatory'];

  var EVENTS = [
    {
      id: 'storm', ref: 'DM-2026-0412', name: 'North Sea winter storm "Ingrid"',
      cat: 'Weather', where: 'AMS · CPH · OSL · EDI · Northern North Sea', detected: '11 FEB 04:12Z',
      score: 87, conf: 4, traj: 'Escalating', tti: '18h', esc: 4, ttiMin: 1080,
      summary: 'A rapidly deepening low is forecast to cross the North Sea with mean surface winds of 45–55 kt and gusts to 75 kt, arriving over the Dutch and Danish coasts during the evening of 12 February. Four independent meteorological services now agree on track and timing, and the intensity forecast has strengthened across the last three model cycles.',
      factors: [
        f('Probability of occurrence', 94, 0.18, '94 / 100', 'Four national met services converge on track within 60 NM; ECMWF and GFS agree on timing within 2h.'),
        f('Severity if realised', 88, 0.18, '88 / 100', 'Gusts to 75 kt exceed crosswind limits for narrowbody operations at AMS 18R/36L and CPH 04L.'),
        f('Geographic reach', 79, 0.12, '6 major hubs', 'Wind field covers AMS, RTM, CPH, OSL, EDI and ABZ plus North Sea helicopter routes.'),
        f('Expected duration', 72, 0.12, '14–20h', 'Storm transit modelled at 16h; residual gusts and swell recovery add about 4h at coastal airports.'),
        f('Time to impact', 76, 0.14, '18h', 'First operational effect expected 12 FEB 22:00Z at AMS.'),
        f('Escalation rate', 81, 0.10, '+11 in 6h', 'Score rose from 76 to 87 across three model cycles as central pressure deepened.'),
        f('Source credibility', 92, 0.10, '4 tier-1 sources', 'KNMI, DMI, Met Office and MetNo — all official national services.'),
        f('Prediction confidence', 85, 0.06, 'High', 'Ensemble spread narrow on track; intensity spread remains moderate beyond hour 18.')
      ],
      domains: [
        { name: 'Airport operations', v: 92 }, { name: 'Flight schedule', v: 90 }, { name: 'Aircraft rotations', v: 84 },
        { name: 'Passengers', v: 81 }, { name: 'Crew', v: 76 }, { name: 'Cargo', v: 48 },
        { name: 'Catering', v: 40 }, { name: 'Maintenance', v: 34 }, { name: 'Regulatory', v: 18 }
      ],
      chain: [
        { ord: 'First order', title: 'Airport capacity reduction', detail: 'Crosswind and gust limits force single-runway operations at AMS and CPH; de-icing and ramp handling slow under wind restrictions.', lik: '88%', lead: '0–2h from onset' },
        { ord: 'Second order', title: 'Arrival delay accumulation and diversion pressure', detail: 'Reduced acceptance rates generate holding and diversions to alternates that are themselves inside the wind field.', lik: '81%', lead: '2–5h' },
        { ord: 'Second order', title: 'Rotation displacement across the evening wave', detail: 'Aircraft finish the day out of position, so the following morning wave starts degraded even if weather clears overnight.', lik: '74%', lead: '5–12h' },
        { ord: 'Third order', title: 'Crew duty limits and passenger misconnection load', detail: 'Extended duty days approach legal limits at outstations, and the misconnect population concentrates on the first morning bank.', lik: '66%', lead: '12–24h' }
      ],
      evidence: [
        { time: '11 FEB 04:12Z', source: 'KNMI', cred: 'Tier 1', role: 'Origin', text: 'Code orange wind warning issued for the Dutch coastal provinces and IJsselmeer area for the evening of 12 February.' },
        { time: '11 FEB 07:40Z', source: 'DMI', cred: 'Tier 1', role: 'Corroborates', text: 'Storm warning for the Danish west coast; mean wind 25–30 m/s with gusts to 38 m/s expected between 20:00 and 06:00 local.' },
        { time: '11 FEB 09:05Z', source: 'Met Office', cred: 'Tier 1', role: 'Corroborates', text: 'Named storm Ingrid; amber warning issued for eastern Scotland including Aberdeen and Edinburgh.' },
        { time: '11 FEB 12:22Z', source: 'Eurocontrol NM', cred: 'Tier 1', role: 'Extends', text: 'Network advisory flags probable capacity reductions in EHAA and EKDK FIRs for the 12 FEB evening period.' },
        { time: '11 FEB 15:31Z', source: 'Regional news aggregate', cred: 'Tier 3', role: 'Contradicts', text: 'Reports the storm arriving "Friday morning", roughly 10h later than the four official forecasts. Down-weighted as a restatement error.' },
        { time: '11 FEB 18:58Z', source: 'AMS airport ops bulletin', cred: 'Tier 1', role: 'Corroborates', text: 'Airport announces precautionary de-icing and wind-plan staffing for the 12 FEB evening period.' }
      ],
      assumptions: [
        'Storm track holds within the current 60 NM ensemble envelope.',
        'Airports apply published wind and crosswind procedures without additional local restrictions.',
        'No concurrent ATC industrial action in the affected FIRs.'
      ],
      gaps: [
        'No published de-icing throughput figures for CPH under sustained wind.',
        'Overnight curfew waiver policy at OSL unconfirmed.',
        'Intensity forecast spread still moderate beyond hour 18.'
      ],
      sopKey: 'storm'
    },
    {
      id: 'atc', ref: 'DM-2026-0398', name: 'French ATC strike notice — 14–16 FEB',
      cat: 'Industrial action', where: 'LFFF · LFMM · LFBB · overflight corridors', detected: '09 FEB 11:20Z',
      score: 82, conf: 4, traj: 'Escalating', tti: '2d 6h', esc: 4, ttiMin: 3240,
      summary: 'Two of three French controller unions have filed a 48-hour strike notice covering 14–16 February. The DGAC has not yet published flight-reduction requirements; historically these appear about 48 hours before the window opens.',
      factors: [
        f('Probability of occurrence', 86, 0.18, '86 / 100', 'Formal notice filed; two of three unions committed, the third still balloting.'),
        f('Severity if realised', 84, 0.18, '84 / 100', 'Comparable previous notices produced 25–40% en-route capacity reduction in LFFF.'),
        f('Geographic reach', 88, 0.12, 'Continent-wide', 'Overflight corridors affect Iberia–Northern Europe and UK–Mediterranean flows.'),
        f('Expected duration', 70, 0.12, '48h + recovery', 'Declared 48h window plus a partial recovery day.'),
        f('Time to impact', 58, 0.14, '2d 6h', 'Window opens 14 FEB 18:00Z.'),
        f('Escalation rate', 64, 0.10, '+6 in 24h', 'Rose when the second union confirmed participation.'),
        f('Source credibility', 90, 0.10, '3 tier-1 sources', 'Union filings, DGAC notice board and Eurocontrol advisory.'),
        f('Prediction confidence', 72, 0.06, 'Moderate', 'Reduction percentages unpublished and the third union ballot is outstanding.')
      ],
      domains: [
        { name: 'Flight schedule', v: 94 }, { name: 'Aircraft rotations', v: 80 }, { name: 'Passengers', v: 78 },
        { name: 'Crew', v: 72 }, { name: 'Regulatory', v: 62 }, { name: 'Cargo', v: 55 },
        { name: 'Airport operations', v: 52 }, { name: 'Catering', v: 22 }, { name: 'Maintenance', v: 16 }
      ],
      chain: [
        { ord: 'First order', title: 'En-route capacity reduction and flow restrictions', detail: 'ATFM slots tighten across French FIRs and reroutes lengthen sectors around French airspace.', lik: '84%', lead: 'At window open' },
        { ord: 'Second order', title: 'Extended block times and fuel uplift changes', detail: 'Reroutes add 15–40 minutes on affected flows, consuming scheduled buffer.', lik: '78%', lead: '0–4h' },
        { ord: 'Third order', title: 'Rotation and crew duty pressure on southern flows', detail: 'Accumulated delay concentrates on late-evening Mediterranean rotations.', lik: '69%', lead: '6–18h' }
      ],
      evidence: [
        { time: '09 FEB 11:20Z', source: 'Union filing', cred: 'Tier 1', role: 'Origin', text: '48-hour strike notice filed for 14–16 February covering en-route control centres.' },
        { time: '10 FEB 08:15Z', source: 'DGAC notice board', cred: 'Tier 1', role: 'Corroborates', text: 'Notice acknowledged; flight-reduction requirement to be published in due course.' },
        { time: '11 FEB 06:44Z', source: 'Eurocontrol NM', cred: 'Tier 1', role: 'Extends', text: 'Advisory issued for possible capacity constraints in LFFF, LFMM and LFBB.' },
        { time: '11 FEB 13:02Z', source: 'Trade press', cred: 'Tier 2', role: 'Extends', text: 'Reports a third union scheduling its ballot result for 12 February.' }
      ],
      assumptions: ['Strike proceeds as filed without a last-minute agreement.', 'DGAC reduction requirement follows the historical 20–30% pattern.'],
      gaps: ['Third union ballot result unknown.', 'No published minimum service staffing levels yet.'],
      sopKey: 'atc'
    },
    {
      id: 'airspace', ref: 'DM-2026-0405', name: 'Eastern Mediterranean airspace restriction',
      cat: 'Geopolitical', where: 'LCCC · LLLL · adjacent FIRs', detected: '10 FEB 19:05Z',
      score: 74, conf: 3, traj: 'Stable', tti: '6h', esc: 3, ttiMin: 360,
      summary: 'A new reserved-area NOTAM covering a large block of the eastern Mediterranean is active from 12 FEB 06:00Z. Two states have issued advisory guidance and the duration wording is open-ended.',
      factors: [
        f('Probability of occurrence', 96, 0.18, '96 / 100', 'NOTAM published and active — occurrence is effectively certain.'),
        f('Severity if realised', 68, 0.18, '68 / 100', 'Corridor narrowing rather than closure; adds routing distance on Asia and Gulf flows.'),
        f('Geographic reach', 62, 0.12, '3 FIRs', 'Two FIRs affected directly and one through displaced traffic.'),
        f('Expected duration', 66, 0.12, 'Indefinite', 'NOTAM states "until further notice".'),
        f('Time to impact', 84, 0.14, '6h', 'Active from 12 FEB 06:00Z.'),
        f('Escalation rate', 41, 0.10, 'Flat 24h', 'No change in extent or wording since publication.'),
        f('Source credibility', 88, 0.10, '2 tier-1 sources', 'State AIS publications plus one national authority advisory.'),
        f('Prediction confidence', 54, 0.06, 'Moderate', 'Duration and possible extension are not stated.')
      ],
      domains: [
        { name: 'Flight schedule', v: 78 }, { name: 'Regulatory', v: 74 }, { name: 'Aircraft rotations', v: 58 },
        { name: 'Crew', v: 54 }, { name: 'Cargo', v: 52 }, { name: 'Passengers', v: 46 },
        { name: 'Airport operations', v: 28 }, { name: 'Maintenance', v: 14 }, { name: 'Catering', v: 12 }
      ],
      chain: [
        { ord: 'First order', title: 'Corridor narrowing and reroute requirement', detail: 'Traffic is displaced onto two remaining corridors, raising sector loading.', lik: '92%', lead: 'At activation' },
        { ord: 'Second order', title: 'Longer sectors and payload trade-offs', detail: 'Added distance affects fuel planning on longer eastbound sectors.', lik: '71%', lead: '0–12h' },
        { ord: 'Third order', title: 'Overflight permit and insurance review load', detail: 'Alternate routings may cross states requiring fresh permits or risk review.', lik: '48%', lead: '12–48h' }
      ],
      evidence: [
        { time: '10 FEB 19:05Z', source: 'State AIS NOTAM', cred: 'Tier 1', role: 'Origin', text: 'Reserved area established from 12 FEB 06:00Z until further notice, surface to unlimited.' },
        { time: '11 FEB 02:10Z', source: 'National authority advisory', cred: 'Tier 1', role: 'Corroborates', text: 'Operators advised to review routings and risk assessments for the affected block.' },
        { time: '11 FEB 10:30Z', source: 'Industry newswire', cred: 'Tier 2', role: 'Extends', text: 'Reports two carriers already filing alternate flight plans avoiding the area.' }
      ],
      assumptions: ['Reserved area boundaries as published are not extended.', 'Adjacent FIRs accept displaced traffic without additional restrictions.'],
      gaps: ['No stated end date.', 'No indication whether altitude bands may be released.'],
      sopKey: 'airspace'
    },
    {
      id: 'zrh', ref: 'DM-2026-0389', name: 'Zurich runway 14/32 closure overrun',
      cat: 'Infrastructure', where: 'ZRH', detected: '07 FEB 08:00Z',
      score: 61, conf: 3, traj: 'Stable', tti: '3d', esc: 2, ttiMin: 4320,
      summary: 'Resurfacing of runway 14/32 is scheduled to complete on 15 February. Contractor progress reports indicate a two- to four-day slippage risk, which would extend reduced-capacity operations into the following week.',
      factors: [
        f('Probability of occurrence', 62, 0.18, '62 / 100', 'Two of five published milestones are behind plan.'),
        f('Severity if realised', 64, 0.18, '64 / 100', 'Single-runway periods reduce peak-hour acceptance by roughly a fifth.'),
        f('Geographic reach', 32, 0.12, 'Single airport', 'Effects concentrated at ZRH with limited spill to alternates.'),
        f('Expected duration', 58, 0.12, '2–4 days', 'Slippage window per the contractor status report.'),
        f('Time to impact', 44, 0.14, '3d', 'First affected period 15 FEB.'),
        f('Escalation rate', 36, 0.10, 'Flat 48h', 'No change since the last progress report.'),
        f('Source credibility', 74, 0.10, 'Mixed', 'Airport works notice tier 1; contractor commentary tier 2.'),
        f('Prediction confidence', 52, 0.06, 'Moderate', 'Completion depends on weather windows not yet forecastable.')
      ],
      domains: [
        { name: 'Airport operations', v: 82 }, { name: 'Flight schedule', v: 66 }, { name: 'Aircraft rotations', v: 48 },
        { name: 'Passengers', v: 44 }, { name: 'Crew', v: 30 }, { name: 'Cargo', v: 26 },
        { name: 'Maintenance', v: 22 }, { name: 'Regulatory', v: 18 }, { name: 'Catering', v: 10 }
      ],
      chain: [
        { ord: 'First order', title: 'Extended single-runway operation', detail: 'Peak acceptance rate stays reduced beyond the planned end date.', lik: '62%', lead: 'From 15 FEB' },
        { ord: 'Second order', title: 'Peak-hour delay accumulation', detail: 'Morning and evening banks absorb the capacity shortfall as reactionary delay.', lik: '58%', lead: '0–6h per day' },
        { ord: 'Third order', title: 'Slot compliance and rotation buffer erosion', detail: 'Repeated daily delay reduces the buffer available for unrelated events.', lik: '41%', lead: 'Multi-day' }
      ],
      evidence: [
        { time: '07 FEB 08:00Z', source: 'ZRH works notice', cred: 'Tier 1', role: 'Origin', text: 'Runway 14/32 closed for resurfacing with planned reopening 15 February.' },
        { time: '10 FEB 16:20Z', source: 'Contractor progress report', cred: 'Tier 2', role: 'Extends', text: 'Two milestones reported behind plan; completion date under review.' }
      ],
      assumptions: ['No additional works are added to the current scope.', 'Published single-runway acceptance rates remain valid.'],
      gaps: ['No revised completion date published.', 'Weather dependency of the final surfacing stage unquantified.'],
      sopKey: 'runway'
    },
    {
      id: 'lis', ref: 'DM-2026-0401', name: 'Lisbon ground-handler strike ballot',
      cat: 'Industrial action', where: 'LIS · OPO · FAO', detected: '08 FEB 14:35Z',
      score: 54, conf: 2, traj: 'Escalating', tti: '5d', esc: 2, ttiMin: 7200,
      summary: 'A ground-handling union has opened a strike ballot over a stalled pay negotiation. The ballot closes 16 February; no strike dates have been named and the mandate threshold has not been published.',
      factors: [
        f('Probability of occurrence', 46, 0.18, '46 / 100', 'Ballot open with no mandate yet and no dates named.'),
        f('Severity if realised', 72, 0.18, '72 / 100', 'Turnaround handling at three airports, including a hub with limited alternative providers.'),
        f('Geographic reach', 44, 0.12, '3 airports', 'LIS, OPO and FAO are covered by the bargaining unit.'),
        f('Expected duration', 50, 0.12, 'Unknown', 'Comparable local actions have run one to three days.'),
        f('Time to impact', 34, 0.14, '5d', 'Earliest credible action follows ballot close.'),
        f('Escalation rate', 58, 0.10, '+4 in 48h', 'Rose as a second bargaining round ended without agreement.'),
        f('Source credibility', 66, 0.10, 'Mixed', 'Union communiqué tier 1; participation estimates from press tier 3.'),
        f('Prediction confidence', 38, 0.06, 'Low', 'Outcome depends on a ballot with no published threshold.')
      ],
      domains: [
        { name: 'Airport operations', v: 76 }, { name: 'Passengers', v: 62 }, { name: 'Flight schedule', v: 58 },
        { name: 'Cargo', v: 54 }, { name: 'Catering', v: 46 }, { name: 'Aircraft rotations', v: 44 },
        { name: 'Crew', v: 26 }, { name: 'Maintenance', v: 18 }, { name: 'Regulatory', v: 12 }
      ],
      chain: [
        { ord: 'First order', title: 'Turnaround handling degradation', detail: 'Reduced baggage, loading and pushback capacity extends ground times.', lik: '58%', lead: 'At action start' },
        { ord: 'Second order', title: 'Departure punctuality decline at the hub', detail: 'Ground time overrun converts into departure delay through the day.', lik: '52%', lead: '0–8h' },
        { ord: 'Third order', title: 'Baggage backlog and reaccommodation load', detail: 'Mishandled bag volume rises and clears slowly after the action ends.', lik: '39%', lead: '1–3 days' }
      ],
      evidence: [
        { time: '08 FEB 14:35Z', source: 'Union communiqué', cred: 'Tier 1', role: 'Origin', text: 'Strike ballot opened over a stalled pay negotiation; ballot closes 16 February.' },
        { time: '10 FEB 09:12Z', source: 'National press', cred: 'Tier 3', role: 'Extends', text: 'Reports "strong support expected" without a numeric basis. Treated as unverified sentiment.' }
      ],
      assumptions: ['Bargaining unit covers the three airports named in the communiqué.', 'Any action would follow the statutory notice period.'],
      gaps: ['Mandate threshold not published.', 'No strike dates named.', 'Minimum service obligations unclear.'],
      sopKey: 'ground'
    },
    {
      id: 'uknight', ref: 'DM-2026-0377', name: 'UK night-flight regulation consultation',
      cat: 'Regulatory', where: 'LHR · LGW · STN', detected: '02 FEB 09:00Z',
      score: 38, conf: 4, traj: 'Improving', tti: '41d', esc: 1, ttiMin: 59040,
      summary: 'A consultation on revised night-quota and movement limits closes 25 March, with any change taking effect from the winter season. The long lead time makes this relevant to schedule planning rather than live operations.',
      factors: [
        f('Probability of occurrence', 88, 0.18, '88 / 100', 'Consultation formally opened with a published timetable.'),
        f('Severity if realised', 44, 0.18, '44 / 100', 'Affects night movement allocation rather than day-of-operation capacity.'),
        f('Geographic reach', 38, 0.12, '3 airports', 'London designated airports only.'),
        f('Expected duration', 62, 0.12, 'Seasonal', 'Any change would apply for a full scheduling season.'),
        f('Time to impact', 12, 0.14, '41d', 'Consultation closes 25 MAR.'),
        f('Escalation rate', 18, 0.10, 'Declining', 'No new submissions of note in the last week.'),
        f('Source credibility', 94, 0.10, 'Tier 1', 'Government consultation portal.'),
        f('Prediction confidence', 78, 0.06, 'High', 'Process and dates are published; the outcome remains open.')
      ],
      domains: [
        { name: 'Regulatory', v: 84 }, { name: 'Flight schedule', v: 58 }, { name: 'Cargo', v: 42 },
        { name: 'Crew', v: 24 }, { name: 'Aircraft rotations', v: 22 }, { name: 'Airport operations', v: 20 },
        { name: 'Passengers', v: 16 }, { name: 'Maintenance', v: 10 }, { name: 'Catering', v: 6 }
      ],
      chain: [
        { ord: 'First order', title: 'Night movement allocation change', detail: 'Revised quota counts would alter permitted night slots at the three designated airports.', lik: '55%', lead: 'Next season' },
        { ord: 'Second order', title: 'Schedule construction constraints', detail: 'Night-arriving long-haul and freighter patterns may need repositioning in the timetable.', lik: '44%', lead: 'Season build' }
      ],
      evidence: [
        { time: '02 FEB 09:00Z', source: 'Government consultation portal', cred: 'Tier 1', role: 'Origin', text: 'Consultation on night flight restrictions at designated London airports opened; closes 25 March.' },
        { time: '05 FEB 11:45Z', source: 'Airport operator statement', cred: 'Tier 1', role: 'Corroborates', text: 'Operator confirms it will respond and publishes current quota utilisation.' }
      ],
      assumptions: ['Consultation timetable holds.', 'Any change applies from the winter season rather than mid-season.'],
      gaps: ['Direction of the proposed change not yet indicated.', 'No draft quota figures published.'],
      sopKey: 'regulatory'
    }
  ];

  var ESC = [
    { code: 'LEVEL 1', badge: 'Watch', title: 'Desk-level watch', desc: 'Monitored on the OCC board. No action beyond continued observation and evidence accumulation.', trigger: 'EDPS below 45, any confidence' },
    { code: 'LEVEL 2', badge: 'Assess', title: 'Duty manager assessment', desc: 'Duty manager reviews exposure and knock-on pathways, then sets a review interval.', trigger: 'EDPS 45–64, or 65+ at low confidence' },
    { code: 'LEVEL 3', badge: 'Engage', title: 'VP engagement', desc: 'VP Network Control Centre briefed on scale, duration, exposure and time available.', trigger: 'EDPS 65–79 at moderate confidence or above' },
    { code: 'LEVEL 4', badge: 'Decide', title: 'VP decision · response cell', desc: 'VP chairs the response cell and approves pre-tactical measures. All decisions remain with the airline.', trigger: 'EDPS 80+ at high confidence, or hub threatened' }
  ];

  var PHASES = [
    { num: '01', title: 'Detect & verify', owner: 'Intelligence desk', window: 'T−72h to T−24h', steps: ['Confirm event correlated across two or more tier-1 sources', 'Resolve flagged contradictions in the evidence trail', 'Record stated assumptions and information gaps', 'Set monitoring interval'] },
    { num: '02', title: 'Assess exposure', owner: 'OCC duty manager', window: 'T−48h to T−12h', steps: ['Review the domain implication profile', 'Walk the knock-on pathway with each desk', 'Identify hub and wave exposure windows', 'Log residual uncertainty'] },
    { num: '03', title: 'Escalation decision', owner: 'Duty manager → VP', window: 'At threshold crossing', steps: ['Compare score and confidence to the threshold table', 'Brief VP on scale, duration, exposure, time available', 'Record the decision and its timestamp', 'Agree the next review point'] },
    { num: '04', title: 'Pre-tactical actions', owner: 'VP NCC (approval)', window: 'T−24h to T−4h', steps: ['Approve the schedule thinning envelope', 'Approve the pre-cancellation window', 'Authorise resource pre-positioning', 'Hand parameters to the airline disruption solver'] },
    { num: '05', title: 'Activate & communicate', owner: 'Response cell', window: 'T−4h to T+end', steps: ['Stand up the response cell and briefing cadence', 'Issue internal and station briefings', 'Align customer communication timing', 'Track deviation from the expected profile'] },
    { num: '06', title: 'Recover & review', owner: 'VP NCC · Intelligence', window: 'T+end to T+7d', steps: ['Close out the event and stand down the cell', 'Reconstruct the intelligence versus action timeline', 'Test whether thresholds were set correctly', 'Update playbook content'] }
  ];

  var SOPS = {
    storm: {
      title: 'SOP — Winter storm / severe wind',
      meta: 'Airline-configured playbook · 4 gates · 12 actions · owner: OCC standards',
      gates: [
        { name: 'Watch', window: 'T−72h to T−36h', state: 'Closed' },
        { name: 'Prepare', window: 'T−36h to T−18h', state: 'Active' },
        { name: 'Storm window', window: 'T−18h to T+16h', state: 'Pending' },
        { name: 'Restore', window: 'T+16h to T+48h', state: 'Pending' }
      ],
      actions: [
        { gate: 'Watch', timing: 'T−72h', text: 'Confirm forecast agreement across national met services and record ensemble spread.', desk: 'Intelligence', type: 'Standing' },
        { gate: 'Watch', timing: 'T−48h', text: 'Identify hubs and waves inside the forecast wind field.', desk: 'Network control', type: 'Standing' },
        { gate: 'Prepare', timing: 'T−36h', text: 'Request de-icing and wind-plan capacity statements from affected airports.', desk: 'Station ops', type: 'Standing' },
        { gate: 'Prepare', timing: 'T−30h', text: 'Review alternate airports for exposure to the same wind field.', desk: 'Flight ops', type: 'Standing' },
        { gate: 'Prepare', timing: 'T−24h', text: 'Brief VP NCC if EDPS remains at or above 80 with high confidence.', desk: 'Duty manager', type: 'Conditional' },
        { gate: 'Prepare', timing: 'T−18h', text: 'If the gust forecast exceeds crosswind limits, prepare schedule thinning options for approval.', desk: 'Network control', type: 'Conditional' },
        { gate: 'Storm window', timing: 'T−6h', text: 'Confirm pre-cancellation decisions are published to stations and customer channels.', desk: 'Response cell', type: 'Gate' },
        { gate: 'Storm window', timing: 'T−2h', text: 'Move to declared disruption cadence with fixed briefing intervals.', desk: 'Response cell', type: 'Gate' },
        { gate: 'Storm window', timing: 'T+0h', text: 'Track actual acceptance rates against the forecast reduction and report deviation.', desk: 'Network control', type: 'Standing' },
        { gate: 'Storm window', timing: 'T+8h', text: 'If diversion count exceeds the agreed threshold, open the recovery aircraft review.', desk: 'Duty manager', type: 'Conditional' },
        { gate: 'Restore', timing: 'T+16h', text: 'Assess overnight positioning and morning wave readiness.', desk: 'Network control', type: 'Standing' },
        { gate: 'Restore', timing: 'T+48h', text: 'Complete the post-event review including the intelligence-versus-action timeline.', desk: 'Intelligence', type: 'Gate' }
      ]
    },
    atc: {
      title: 'SOP — ATC industrial action',
      meta: 'Airline-configured playbook · 4 gates · 10 actions · owner: OCC standards',
      gates: [
        { name: 'Notice', window: 'Filing to T−96h', state: 'Closed' },
        { name: 'Prepare', window: 'T−96h to T−48h', state: 'Active' },
        { name: 'Commit', window: 'T−48h to T−12h', state: 'Pending' },
        { name: 'Strike window', window: 'T−0h to T+48h', state: 'Pending' }
      ],
      actions: [
        { gate: 'Notice', timing: 'At filing', text: 'Record notice scope, unions involved and the declared window.', desk: 'Intelligence', type: 'Standing' },
        { gate: 'Notice', timing: 'T−120h', text: 'Retrieve capacity reduction outcomes from comparable previous notices.', desk: 'Intelligence', type: 'Standing' },
        { gate: 'Prepare', timing: 'T−96h', text: 'If the third union ballot passes, re-score the event and re-brief.', desk: 'Intelligence', type: 'Conditional' },
        { gate: 'Prepare', timing: 'T−72h', text: 'Map exposed overflight corridors and identify reroute options.', desk: 'Flight ops', type: 'Standing' },
        { gate: 'Prepare', timing: 'T−60h', text: 'Brief VP NCC on the projected reduction range and cost envelope.', desk: 'Duty manager', type: 'Gate' },
        { gate: 'Commit', timing: 'T−48h', text: 'Await the DGAC reduction requirement; if unpublished by T−36h, plan against the historical range.', desk: 'Network control', type: 'Conditional' },
        { gate: 'Commit', timing: 'T−36h', text: 'Submit the pre-cancellation list to the airline disruption solver for construction.', desk: 'Network control', type: 'Gate' },
        { gate: 'Commit', timing: 'T−24h', text: 'Confirm crew and passenger communication timing.', desk: 'Response cell', type: 'Standing' },
        { gate: 'Strike window', timing: 'T−0h', text: 'Monitor actual slot issue rates against the planned reduction.', desk: 'Network control', type: 'Standing' },
        { gate: 'Strike window', timing: 'T+48h', text: 'Close out and record when the reduction requirement became known.', desk: 'Intelligence', type: 'Gate' }
      ]
    },
    airspace: {
      title: 'SOP — Airspace restriction',
      meta: 'Airline-configured playbook · 3 gates · 8 actions · owner: Flight ops standards',
      gates: [
        { name: 'Publication', window: 'At NOTAM issue', state: 'Closed' },
        { name: 'Assess', window: 'Issue to activation', state: 'Active' },
        { name: 'Active period', window: 'Activation onward', state: 'Pending' }
      ],
      actions: [
        { gate: 'Publication', timing: 'At issue', text: 'Record boundaries, altitude bands and stated duration.', desk: 'Intelligence', type: 'Standing' },
        { gate: 'Publication', timing: 'T−12h', text: 'Cross-check against adjacent state publications for conflicting extents.', desk: 'Intelligence', type: 'Standing' },
        { gate: 'Assess', timing: 'T−10h', text: 'Identify affected flows and corridor capacity after displacement.', desk: 'Flight ops', type: 'Standing' },
        { gate: 'Assess', timing: 'T−8h', text: 'If reroutes cross states requiring permits, open the permit review.', desk: 'Regulatory', type: 'Conditional' },
        { gate: 'Assess', timing: 'T−6h', text: 'Review the security risk assessment for alternate routings.', desk: 'Safety & security', type: 'Gate' },
        { gate: 'Assess', timing: 'T−4h', text: 'Brief the duty manager on fuel and payload consequences.', desk: 'Flight ops', type: 'Standing' },
        { gate: 'Active period', timing: 'T+0h', text: 'Monitor for extension or altitude release amendments.', desk: 'Intelligence', type: 'Standing' },
        { gate: 'Active period', timing: 'Daily', text: 'Re-confirm the restriction remains as published while the duration is open-ended.', desk: 'Intelligence', type: 'Standing' }
      ]
    },
    runway: {
      title: 'SOP — Runway closure / works overrun',
      meta: 'Airline-configured playbook · 3 gates · 7 actions · owner: Station ops standards',
      gates: [
        { name: 'Planned works', window: 'Notice to T−7d', state: 'Closed' },
        { name: 'Slippage watch', window: 'T−7d to planned end', state: 'Active' },
        { name: 'Extended period', window: 'Beyond planned end', state: 'Pending' }
      ],
      actions: [
        { gate: 'Planned works', timing: 'At notice', text: 'Record scope, published acceptance rates and the planned reopening date.', desk: 'Intelligence', type: 'Standing' },
        { gate: 'Slippage watch', timing: 'Weekly', text: 'Track contractor milestone progress against plan.', desk: 'Station ops', type: 'Standing' },
        { gate: 'Slippage watch', timing: 'T−72h', text: 'If completion slips, model reduced-capacity days beyond the planned end.', desk: 'Network control', type: 'Conditional' },
        { gate: 'Slippage watch', timing: 'T−48h', text: 'Request a revised completion date in writing from the airport.', desk: 'Station ops', type: 'Gate' },
        { gate: 'Slippage watch', timing: 'T−24h', text: 'Brief the duty manager on peak-hour exposure per affected day.', desk: 'Network control', type: 'Standing' },
        { gate: 'Extended period', timing: 'Daily', text: 'Review slot compliance and reactionary delay carry-over.', desk: 'Network control', type: 'Standing' },
        { gate: 'Extended period', timing: 'At reopening', text: 'Confirm the full acceptance rate is restored before releasing buffer.', desk: 'Station ops', type: 'Gate' }
      ]
    },
    ground: {
      title: 'SOP — Ground handler industrial action',
      meta: 'Airline-configured playbook · 4 gates · 9 actions · owner: Station ops standards',
      gates: [
        { name: 'Ballot', window: 'Ballot open to close', state: 'Active' },
        { name: 'Prepare', window: 'Mandate to notice', state: 'Pending' },
        { name: 'Commit', window: 'T−48h to T−0h', state: 'Pending' },
        { name: 'Action window', window: 'T−0h onward', state: 'Pending' }
      ],
      actions: [
        { gate: 'Ballot', timing: 'At opening', text: 'Record the bargaining unit, airports covered and ballot close date.', desk: 'Intelligence', type: 'Standing' },
        { gate: 'Ballot', timing: 'Ongoing', text: 'Down-weight unsourced participation estimates in the evidence trail.', desk: 'Intelligence', type: 'Standing' },
        { gate: 'Ballot', timing: 'At close', text: 'If the ballot passes, re-score the event and move to Prepare.', desk: 'Intelligence', type: 'Conditional' },
        { gate: 'Prepare', timing: 'At mandate', text: 'Confirm alternative handling capacity and contractual coverage per station.', desk: 'Station ops', type: 'Standing' },
        { gate: 'Prepare', timing: 'T−96h', text: 'Assess minimum service obligations where they apply.', desk: 'Regulatory', type: 'Conditional' },
        { gate: 'Commit', timing: 'T−48h', text: 'Brief the duty manager on turnaround time assumptions per station.', desk: 'Station ops', type: 'Gate' },
        { gate: 'Commit', timing: 'T−24h', text: 'Agree the baggage acceptance and customer communication position.', desk: 'Response cell', type: 'Standing' },
        { gate: 'Action window', timing: 'T−0h', text: 'Track actual ground times against assumption and report deviation.', desk: 'Station ops', type: 'Standing' },
        { gate: 'Action window', timing: 'T+24h', text: 'Monitor baggage backlog clearance rate.', desk: 'Station ops', type: 'Standing' }
      ]
    },
    regulatory: {
      title: 'SOP — Regulatory change / consultation',
      meta: 'Airline-configured playbook · 3 gates · 6 actions · owner: Regulatory affairs',
      gates: [
        { name: 'Open', window: 'Publication to close', state: 'Active' },
        { name: 'Decision', window: 'Close to determination', state: 'Pending' },
        { name: 'Implementation', window: 'Determination onward', state: 'Pending' }
      ],
      actions: [
        { gate: 'Open', timing: 'At publication', text: 'Record scope, affected airports and the consultation timetable.', desk: 'Regulatory', type: 'Standing' },
        { gate: 'Open', timing: 'Monthly', text: 'Track published submissions for indications of likely direction.', desk: 'Regulatory', type: 'Standing' },
        { gate: 'Open', timing: 'T−14d', text: 'If draft figures are published, model the schedule construction impact.', desk: 'Network planning', type: 'Conditional' },
        { gate: 'Decision', timing: 'At close', text: 'Submit the airline response and log the expected determination date.', desk: 'Regulatory', type: 'Gate' },
        { gate: 'Decision', timing: 'At determination', text: 'Re-score the event against the final measure.', desk: 'Intelligence', type: 'Standing' },
        { gate: 'Implementation', timing: 'Season build', text: 'Feed confirmed limits into the season timetable build.', desk: 'Network planning', type: 'Gate' }
      ]
    }
  };

  var RETRO = {
    storm: {
      stats: [
        { k: 'FIRST SIGNAL', v: '11 FEB 04:12Z', note: 'KNMI code orange' },
        { k: 'FIRST ACTION', v: '11 FEB 16:05Z', note: 'Duty manager assessment' },
        { k: 'LEAD TIME LOST', v: '11h 53m', note: 'First signal to first action' }
      ],
      rows: [
        { time: '04:12Z', edps: 58, conf: 'Mod', intelTitle: 'Single-source wind warning detected', intelDetail: 'KNMI code orange issued for the Dutch coast. Event created at Level 1 desk watch.' },
        { time: '07:40Z', edps: 66, conf: 'Mod', intelTitle: 'Second tier-1 source corroborates', intelDetail: 'DMI storm warning for the Danish west coast confirms track and timing.' },
        { time: '09:05Z', edps: 71, conf: 'Mod', intelTitle: 'Storm named, third source agrees', intelDetail: 'Met Office names Ingrid; amber warning covers eastern Scotland.' },
        { time: '12:22Z', edps: 78, conf: 'High', intelTitle: 'Network capacity advisory published', intelDetail: 'Eurocontrol flags probable reductions in EHAA and EKDK. Level 3 threshold crossed.' },
        { time: '16:05Z', edps: 81, conf: 'High', actionTitle: 'Duty manager assessment opened', actionDetail: 'Exposure review started 3h 43m after the Level 3 threshold was crossed.', actionRole: 'OCC duty manager' },
        { time: '18:58Z', edps: 84, conf: 'High', intelTitle: 'Airport confirms wind-plan staffing', intelDetail: 'AMS ops bulletin corroborates the operational read of the forecast.' },
        { time: '21:30Z', edps: 87, conf: 'High', actionTitle: 'VP briefed · response cell stood up', actionDetail: 'Briefing held 9h 08m after the Level 3 threshold and 17h 18m after first signal.', actionRole: 'VP Network Control Centre' },
        { time: '02:10Z', edps: 87, conf: 'High', actionTitle: 'Pre-tactical thinning approved', actionDetail: 'Schedule thinning envelope and pre-cancellation window approved for the evening wave.', actionRole: 'VP Network Control Centre' }
      ]
    }
  };


  // Airports in the area of effect and the carriers whose PUBLISHED operations touch them.
  // Everything here derives from public sources — published timetables, airport movement
  // statistics and open slot data. No airline's own schedule, crew or fleet data is used.
  var OPS = {
    storm: {
      basis: 'Published winter timetable movements at the six airports inside the forecast wind field, cross-checked against airport movement statistics.',
      airports: [
        { iata: 'AMS', name: 'Amsterdam Schiphol', role: 'Major hub', movements: 1420, window: '12 FEB 22:00Z – 13 FEB 12:00Z', exposure: 92, note: 'Crosswind limits on 18R/36L; single-runway periods likely' },
        { iata: 'CPH', name: 'Copenhagen Kastrup', role: 'Hub', movements: 640, window: '12 FEB 20:00Z – 13 FEB 08:00Z', exposure: 84, note: 'Gusts exceed limits on 04L; de-icing throughput unpublished' },
        { iata: 'OSL', name: 'Oslo Gardermoen', role: 'Hub', movements: 580, window: '13 FEB 00:00Z – 13 FEB 10:00Z', exposure: 71, note: 'Curfew waiver policy unconfirmed' },
        { iata: 'EDI', name: 'Edinburgh', role: 'Base', movements: 310, window: '12 FEB 18:00Z – 13 FEB 06:00Z', exposure: 66, note: 'Amber wind warning for eastern Scotland' },
        { iata: 'ABZ', name: 'Aberdeen Dyce', role: 'Regional', movements: 145, window: '12 FEB 18:00Z – 13 FEB 08:00Z', exposure: 58, note: 'North Sea helicopter routes also affected' },
        { iata: 'RTM', name: 'Rotterdam The Hague', role: 'Secondary', movements: 90, window: '12 FEB 22:00Z – 13 FEB 08:00Z', exposure: 44, note: 'Limited alternate capacity during the wind field' }
      ],
      airlines: [
        { name: 'KLM Royal Dutch Airlines', code: 'KL', hub: 'AMS', daily: 486, netShare: 61, airports: 'AMS · RTM', exposure: 'Critical', note: 'Hub inside the wind field during the evening wave' },
        { name: 'Transavia', code: 'HV', hub: 'AMS', daily: 128, netShare: 44, airports: 'AMS · RTM', exposure: 'Critical', note: 'Point-to-point base at AMS and RTM' },
        { name: 'SAS', code: 'SK', hub: 'CPH', daily: 214, netShare: 38, airports: 'CPH · OSL', exposure: 'High', note: 'Two bases inside the forecast area' },
        { name: 'Norwegian', code: 'DY', hub: 'OSL', daily: 176, netShare: 33, airports: 'OSL · CPH · EDI', exposure: 'High', note: 'Nordic network concentrated in the affected block' },
        { name: 'easyJet', code: 'U2', hub: 'EDI', daily: 142, netShare: 12, airports: 'EDI · AMS · CPH', exposure: 'Moderate', note: 'Base at EDI; the wider network absorbs displacement' },
        { name: 'British Airways', code: 'BA', hub: 'LHR', daily: 68, netShare: 6, airports: 'EDI · ABZ · AMS', exposure: 'Moderate', note: 'Domestic shuttle and AMS frequency exposed' },
        { name: 'Widerøe', code: 'WF', hub: 'OSL', daily: 54, netShare: 21, airports: 'OSL', exposure: 'Moderate', note: 'Short-sector regional network' }
      ]
    },
    atc: {
      basis: 'Published departures and filed overflight volumes across the three French FIRs, from open timetable and network data.',
      airports: [
        { iata: 'CDG', name: 'Paris Charles de Gaulle', role: 'Major hub', movements: 1380, window: '14 FEB 18:00Z – 16 FEB 18:00Z', exposure: 90, note: 'En-route reduction affects both waves' },
        { iata: 'ORY', name: 'Paris Orly', role: 'Hub', movements: 620, window: '14 FEB 18:00Z – 16 FEB 18:00Z', exposure: 82, note: 'Slot-constrained; limited recovery room' },
        { iata: 'LYS', name: 'Lyon Saint-Exupéry', role: 'Base', movements: 285, window: '14 FEB 18:00Z – 16 FEB 18:00Z', exposure: 68, note: 'LFMM sector loading' },
        { iata: 'MRS', name: 'Marseille Provence', role: 'Base', movements: 240, window: '14 FEB 18:00Z – 16 FEB 18:00Z', exposure: 65, note: 'Mediterranean flows reroute around the FIR' },
        { iata: 'TLS', name: 'Toulouse Blagnac', role: 'Base', movements: 210, window: '14 FEB 18:00Z – 16 FEB 18:00Z', exposure: 60, note: 'LFBB affected' },
        { iata: 'BOD', name: 'Bordeaux Mérignac', role: 'Regional', movements: 150, window: '14 FEB 18:00Z – 16 FEB 18:00Z', exposure: 54, note: 'Iberia–Northern Europe corridor overhead' }
      ],
      airlines: [
        { name: 'Air France', code: 'AF', hub: 'CDG', daily: 742, netShare: 68, airports: 'CDG · ORY · LYS · MRS · TLS · BOD', exposure: 'Critical', note: 'Entire domestic and short-haul network inside the affected FIRs' },
        { name: 'Transavia France', code: 'TO', hub: 'ORY', daily: 168, netShare: 57, airports: 'ORY · LYS · NTE', exposure: 'Critical', note: 'Base network wholly within French airspace' },
        { name: 'easyJet', code: 'U2', hub: 'CDG', daily: 196, netShare: 17, airports: 'CDG · ORY · LYS · TLS', exposure: 'High', note: 'French bases plus heavy overflight exposure' },
        { name: 'Ryanair', code: 'FR', hub: 'BVA', daily: 184, netShare: 9, airports: 'BVA · MRS · TLS · BOD', exposure: 'High', note: 'UK–Iberia flows cross the affected corridors' },
        { name: 'Vueling', code: 'VY', hub: 'BCN', daily: 96, netShare: 14, airports: 'ORY · TLS · MRS', exposure: 'High', note: 'Iberia–Northern Europe routings displaced' },
        { name: 'Lufthansa', code: 'LH', hub: 'FRA', daily: 74, netShare: 5, airports: 'CDG · LYS · MRS', exposure: 'Moderate', note: 'Overflight rerouting on Mediterranean sectors' },
        { name: 'Iberia', code: 'IB', hub: 'MAD', daily: 62, netShare: 7, airports: 'CDG · ORY', exposure: 'Moderate', note: 'Northbound corridor capacity reduced' }
      ]
    },
    airspace: {
      basis: 'Published departures at airports adjacent to the reserved area, plus filed routings through the affected corridors.',
      airports: [
        { iata: 'LCA', name: 'Larnaca', role: 'Hub', movements: 210, window: 'From 12 FEB 06:00Z, open-ended', exposure: 78, note: 'Departure and arrival corridors narrowed' },
        { iata: 'TLV', name: 'Tel Aviv Ben Gurion', role: 'Major hub', movements: 480, window: 'From 12 FEB 06:00Z, open-ended', exposure: 72, note: 'Westbound routings displaced onto two corridors' },
        { iata: 'BEY', name: 'Beirut Rafic Hariri', role: 'Hub', movements: 140, window: 'From 12 FEB 06:00Z, open-ended', exposure: 64, note: 'Limited corridor alternatives' },
        { iata: 'PFO', name: 'Paphos', role: 'Secondary', movements: 65, window: 'From 12 FEB 06:00Z, open-ended', exposure: 42, note: 'Shares displaced Cyprus traffic' }
      ],
      airlines: [
        { name: 'El Al', code: 'LY', hub: 'TLV', daily: 118, netShare: 74, airports: 'TLV', exposure: 'Critical', note: 'Single-hub network; every westbound sector affected' },
        { name: 'Middle East Airlines', code: 'ME', hub: 'BEY', daily: 62, netShare: 68, airports: 'BEY', exposure: 'Critical', note: 'Hub adjacent to the reserved area' },
        { name: 'Aegean Airlines', code: 'A3', hub: 'ATH', daily: 74, netShare: 16, airports: 'LCA · PFO · TLV · BEY', exposure: 'High', note: 'Eastern Mediterranean network concentrated here' },
        { name: 'Cyprus Airways', code: 'CY', hub: 'LCA', daily: 28, netShare: 62, airports: 'LCA · PFO', exposure: 'High', note: 'Both bases inside the affected block' },
        { name: 'Emirates', code: 'EK', hub: 'DXB', daily: 46, netShare: 4, airports: 'Overflight', exposure: 'Moderate', note: 'Europe–Gulf routings add distance' },
        { name: 'Qatar Airways', code: 'QR', hub: 'DOH', daily: 52, netShare: 5, airports: 'Overflight', exposure: 'Moderate', note: 'Alternate routings may need fresh permits' }
      ]
    },
    zrh: {
      basis: 'Published movements at ZRH against the airport\'s stated single-runway acceptance rates.',
      airports: [
        { iata: 'ZRH', name: 'Zurich', role: 'Major hub', movements: 720, window: '15 FEB onward, 2–4 days', exposure: 82, note: 'Peak-hour acceptance reduced by roughly a fifth' }
      ],
      airlines: [
        { name: 'SWISS', code: 'LX', hub: 'ZRH', daily: 312, netShare: 64, airports: 'ZRH', exposure: 'Critical', note: 'Hub waves absorb the full capacity shortfall' },
        { name: 'Edelweiss Air', code: 'WK', hub: 'ZRH', daily: 34, netShare: 88, airports: 'ZRH', exposure: 'Critical', note: 'Single-base leisure operation' },
        { name: 'Lufthansa', code: 'LH', hub: 'FRA', daily: 46, netShare: 3, airports: 'ZRH', exposure: 'Moderate', note: 'Feeder frequency to ZRH' },
        { name: 'easyJet Switzerland', code: 'DS', hub: 'GVA', daily: 38, netShare: 11, airports: 'ZRH', exposure: 'Moderate', note: 'Swiss base network partly exposed' },
        { name: 'British Airways', code: 'BA', hub: 'LHR', daily: 18, netShare: 2, airports: 'ZRH', exposure: 'Low', note: 'Trunk frequency only' }
      ]
    },
    lis: {
      basis: 'Published departures at the three airports covered by the bargaining unit, from open timetable data.',
      airports: [
        { iata: 'LIS', name: 'Lisbon Humberto Delgado', role: 'Major hub', movements: 620, window: 'Earliest 17 FEB, after ballot close', exposure: 76, note: 'Limited alternative handling providers' },
        { iata: 'OPO', name: 'Porto', role: 'Base', movements: 280, window: 'Earliest 17 FEB', exposure: 62, note: 'Turnaround handling covered by the same unit' },
        { iata: 'FAO', name: 'Faro', role: 'Seasonal base', movements: 150, window: 'Earliest 17 FEB', exposure: 48, note: 'Lower winter frequency reduces exposure' }
      ],
      airlines: [
        { name: 'TAP Air Portugal', code: 'TP', hub: 'LIS', daily: 268, netShare: 71, airports: 'LIS · OPO · FAO', exposure: 'Critical', note: 'Hub and both secondary bases inside the bargaining unit' },
        { name: 'Ryanair', code: 'FR', hub: 'OPO', daily: 154, netShare: 8, airports: 'LIS · OPO · FAO', exposure: 'High', note: 'Portuguese bases rely on the affected handler' },
        { name: 'easyJet', code: 'U2', hub: 'LIS', daily: 86, netShare: 7, airports: 'LIS · OPO · FAO', exposure: 'High', note: 'Base at LIS with tight turnarounds' },
        { name: 'Azores Airlines', code: 'S4', hub: 'PDL', daily: 22, netShare: 34, airports: 'LIS · OPO', exposure: 'Moderate', note: 'Mainland connection points affected' },
        { name: 'Vueling', code: 'VY', hub: 'BCN', daily: 26, netShare: 4, airports: 'LIS · OPO', exposure: 'Low', note: 'Iberian frequency only' }
      ]
    },
    uknight: {
      basis: 'Published night-period movements and open quota utilisation at the three designated London airports.',
      airports: [
        { iata: 'LHR', name: 'London Heathrow', role: 'Major hub', movements: 1310, window: 'Winter season, if adopted', exposure: 74, note: 'Night quota count is the binding constraint' },
        { iata: 'LGW', name: 'London Gatwick', role: 'Base', movements: 780, window: 'Winter season, if adopted', exposure: 62, note: 'Early-morning arrival bank exposed' },
        { iata: 'STN', name: 'London Stansted', role: 'Base', movements: 560, window: 'Winter season, if adopted', exposure: 58, note: 'Freight night movements concentrated here' }
      ],
      airlines: [
        { name: 'British Airways', code: 'BA', hub: 'LHR', daily: 648, netShare: 52, airports: 'LHR · LGW', exposure: 'High', note: 'Night-arriving long-haul bank would need repositioning' },
        { name: 'Ryanair', code: 'FR', hub: 'STN', daily: 226, netShare: 11, airports: 'STN', exposure: 'High', note: 'Largest STN base; early rotations use night shoulders' },
        { name: 'easyJet', code: 'U2', hub: 'LGW', daily: 268, netShare: 22, airports: 'LGW · STN', exposure: 'High', note: 'First-wave departures sit in the night period' },
        { name: 'Virgin Atlantic', code: 'VS', hub: 'LHR', daily: 42, netShare: 46, airports: 'LHR', exposure: 'Moderate', note: 'Night-arriving transatlantic pattern' },
        { name: 'FedEx Express', code: 'FX', hub: 'STN', daily: 14, netShare: 6, airports: 'STN', exposure: 'Moderate', note: 'Freighter night movements directly quota-counted' }
      ]
    }
  };

  window.DM_DATA = { DOMAINS: DOMAINS, EVENTS: EVENTS, ESC: ESC, PHASES: PHASES, SOPS: SOPS, RETRO: RETRO, OPS: OPS };
})();

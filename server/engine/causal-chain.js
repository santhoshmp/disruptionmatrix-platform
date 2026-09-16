// causal-chain.js — Expands preliminary effects into 1st/2nd/3rd order causal chain
// Each chain entry: { ord, title, detail, lik, lead }

// Category-specific chain templates
const CHAIN_TEMPLATES = {
  'Weather': {
    first: { title: 'Direct operational impact', detail: 'Reduced airport capacity and approach constraints due to weather conditions.' },
    second: { title: 'Delay accumulation and rotation displacement', detail: 'Reduced capacity leads to delay propagation through connected banks and rotations.' },
    third: { title: 'Crew duty and passenger misconnection load', detail: 'Extended duty days and misconnect populations concentrate on subsequent banks.' },
  },
  'ATC / Airspace': {
    first: { title: 'Flow restriction and ground delays', detail: 'ATFM regulation reduces sector throughput, causing departure delays and airborne holding.' },
    second: { title: 'Rotation disruption and re-routing', detail: 'Aircraft rotations break as flights accumulate delays; re-routing adds block time.' },
    third: { title: 'Crew legality and connection risk', detail: 'Crew duty limits approached; downstream connections at risk of misconnection.' },
  },
  'Industrial action': {
    first: { title: 'Reduced handling and ground capacity', detail: 'Industrial action reduces ground handling, check-in, or ATC capacity at affected stations.' },
    second: { title: 'Flight cancellations and schedule degradation', detail: 'Reduced capacity forces cancellations and schedule restructuring.' },
    third: { title: 'Passenger re-accommodation and recovery cost', detail: 'Disrupted passengers require re-accommodation; recovery operations extend over days.' },
  },
  'Geopolitical': {
    first: { title: 'Airspace rerouting and block time extension', detail: 'Airspace restrictions force rerouting, increasing block times and fuel burn.' },
    second: { title: 'Rotation and crew duty implications', detail: 'Extended block times disrupt rotations and approach crew duty limits.' },
    third: { title: 'Regulatory compliance and cost impact', detail: 'Compliance with new routing requirements and potential overflight cost changes.' },
  },
  'Infrastructure': {
    first: { title: 'Reduced airport capacity', detail: 'Infrastructure failure (runway, ILS, fuel) reduces airport throughput or capability.' },
    second: { title: 'Weight restrictions or tech stops', detail: 'Fuel supply issues may require tankering; runway closures force payload restrictions.' },
    third: { title: 'Maintenance and recovery operations', detail: 'Recovery requires maintenance coordination and potential fleet reallocation.' },
  },
  'Regulatory': {
    first: { title: 'Compliance review and fleet restriction', detail: 'New regulatory requirements may restrict certain aircraft types or crew qualifications.' },
    second: { title: 'Schedule and route adjustments', detail: 'Compliance may require schedule changes, route modifications, or crew requalification.' },
    third: { title: 'Long-term operational impact', detail: 'Sustained compliance costs and potential competitive disadvantage if not addressed promptly.' },
  },
};

// Likelihood decay: first order = EDPS%, second = EDPS * 0.82, third = EDPS * 0.65
const LIKELIHOOD_DECAY = [1.0, 0.82, 0.65];

// Lead time templates (varies by category)
const LEAD_TIMES = {
  'Weather': ['At onset', '2-6h', '6-24h'],
  'ATC / Airspace': ['0-1h', '1-3h', '3-8h'],
  'Industrial action': ['2-6h', '12-24h', '1-3 days'],
  'Geopolitical': ['0-2h', '2-6h', '6-24h'],
  'Infrastructure': ['0-2h', '2-6h', '6-24h'],
  'Regulatory': ['24-48h', '1-2 weeks', '1-3 months'],
};

export function expandChain(event) {
  const template = CHAIN_TEMPLATES[event.cat] || CHAIN_TEMPLATES['Weather'];
  const edps = event.score || 50;
  const leadTimes = LEAD_TIMES[event.cat] || LEAD_TIMES['Weather'];
  const orders = ['First order', 'Second order', 'Third order'];

  // Use the event summary for the first-order detail if available
  const firstDetail = event.summary || template.first.detail;

  return orders.map((ord, i) => {
    const key = i === 0 ? 'first' : i === 1 ? 'second' : 'third';
    const t = template[key];
    const lik = Math.round(edps * LIKELIHOOD_DECAY[i]);

    return {
      ord,
      title: t.title,
      detail: i === 0 ? firstDetail : t.detail,
      lik: `${lik}%`,
      lead: leadTimes[i],
    };
  });
}

export default { expandChain };

import { Link } from 'react-router-dom';
import { MONO, TEAL, CYAN } from '../theme.js';
import { AIRLINES } from '../airlines.js';

function AirlineLogo({ airline, size = 48 }) {
  const c = airline.accent;
  return (
    <div style={{
      width: size, height: size, borderRadius: 12, flexShrink: 0,
      background: `linear-gradient(135deg, ${c}22, ${c}08)`,
      border: `1.5px solid ${c}55`,
      display: 'grid', placeItems: 'center',
      position: 'relative', overflow: 'hidden'
    }}>
      <div style={{
        position: 'absolute', top: -size * 0.3, right: -size * 0.2,
        width: size * 0.7, height: size * 0.7, borderRadius: '50%',
        background: `${c}10`
      }} />
      <div style={{
        ...MONO, fontSize: size * 0.28, fontWeight: 800, color: c,
        letterSpacing: '-0.02em', position: 'relative', zIndex: 1
      }}>{airline.code}</div>
    </div>
  );
}

function GlobalLogo({ size = 48 }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: 12, flexShrink: 0,
      background: `linear-gradient(135deg, ${TEAL}22, ${TEAL}08)`,
      border: `1.5px solid ${TEAL}55`,
      display: 'grid', placeItems: 'center',
      position: 'relative', overflow: 'hidden'
    }}>
      <div style={{
        position: 'absolute', top: -size * 0.3, right: -size * 0.2,
        width: size * 0.7, height: size * 0.7, borderRadius: '50%',
        background: `${TEAL}10`
      }} />
      <svg viewBox="0 0 24 24" width={size * 0.5} height={size * 0.5} fill="none" stroke={TEAL} strokeWidth="1.8" strokeLinecap="round" style={{ position: 'relative', zIndex: 1 }}>
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18M12 3a14 14 0 010 18M12 3a14 14 0 000 18" />
      </svg>
    </div>
  );
}

function Card({ logo, label, labelColor, title, description, to, accent }) {
  return (
    <div style={{
      padding: 24, border: '1px solid var(--line2)', background: 'var(--panel)',
      borderTop: `3px solid ${accent}`, display: 'flex', flexDirection: 'column'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
        {logo}
        <div>
          <div style={{ ...MONO, fontSize: 10, letterSpacing: '0.12em', color: labelColor, marginBottom: 2 }}>{label}</div>
          <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.2px' }}>{title}</div>
        </div>
      </div>
      <div style={{ fontSize: 13, color: 'var(--mute2)', lineHeight: 1.55, marginBottom: 20, flex: 1 }}>
        {description}
      </div>
      <Link to={to} style={{
        display: 'block', textAlign: 'center', padding: '12px 16px', fontSize: 13.5, fontWeight: 600,
        border: `1px solid ${accent}`, background: accent + '1F', color: 'var(--ink)'
      }}>
        Open dashboard →
      </Link>
    </div>
  );
}

export default function Home() {
  return (
    <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
      <div style={{ position: 'relative', height: 200, overflow: 'hidden', borderBottom: '1px solid var(--line2)' }}>
        <img src="/hero.png" alt="Aircraft on runway" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 60%', display: 'block' }} />
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(135deg, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0.1) 40%, rgba(0,0,0,0.45) 100%)'
        }} />
      </div>

      <div style={{ maxWidth: 920, width: '100%', margin: '0 auto', padding: '28px 24px 40px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
          <Card
            logo={<GlobalLogo />}
            label="GLOBAL VIEW"
            labelColor={TEAL}
            title="DisruptionMatrix"
            description="External intelligence, correlated and scored. Weather, industrial action, geopolitical incidents, infrastructure and regulatory events ranked by disruption potential."
            to="/board"
            accent={TEAL}
          />
          <Card
            logo={<AirlineLogo airline={AIRLINES.namma} />}
            label="AIRLINE VIEW"
            labelColor={CYAN}
            title="Namma Air"
            description="Bengaluru-based carrier with A320neo/A350 fleet. Monsoon, fuel, and fog exposure across the BLR hub and DEL network."
            to="/radar"
            accent={CYAN}
          />
          <Card
            logo={<AirlineLogo airline={AIRLINES.eva} />}
            label="AIRLINE VIEW"
            labelColor={AIRLINES.eva.accent}
            title="EuroVista Airways"
            description="Vienna-based European carrier with E195/A320neo/A321neo fleet. Convective weather, ATFM regulations, and winter ops across the FRA–MUC–VIE corridor."
            to="/eva/radar"
            accent={AIRLINES.eva.accent}
          />
          <Card
            logo={<AirlineLogo airline={AIRLINES.ica} />}
            label="AIRLINE VIEW"
            labelColor={AIRLINES.ica.accent}
            title="IndiConnect Airways"
            description="Delhi-based Indian carrier with A320neo/A321neo/ATR 72 fleet. Fog, monsoon, and ATC disruptions across the DEL–BOM–BLR network."
            to="/ica/radar"
            accent={AIRLINES.ica.accent}
          />
        </div>
      </div>
    </div>
  );
}

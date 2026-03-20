// HUD.jsx — energy bar, score, life icons, mute toggle

import { useGameStore } from '../game/store';

export default function HUD() {
  const { energy, lives, score, miceCaught, isNight, phase } = useGameStore();

  if (phase === 'summary' || phase === 'locked' || phase === 'intro') return null;

  const energyPct = Math.max(0, Math.min(1, energy)) * 100;
  const energyColor = energy < 0.15 ? '#ff3333' : energy < 0.30 ? '#ffaa00' : '#44cc66';
  const pulse = energy < 0.15 ? 'pulse-red' : energy < 0.30 ? 'pulse-amber' : '';

  return (
    <div style={{
      position: 'absolute',
      inset: 0,
      pointerEvents: 'none',
      fontFamily: 'monospace',
    }}>
      {/* Top-left: energy + lives */}
      <div style={{
        position: 'absolute',
        top: 12,
        left: 14,
        display: 'flex',
        flexDirection: 'column',
        gap: 5,
      }}>
        {/* Energy bar */}
        <div style={{
          width: 100,
          height: 8,
          background: 'rgba(0,0,0,0.35)',
          borderRadius: 4,
          overflow: 'hidden',
          boxShadow: energy < 0.3 ? `0 0 8px ${energyColor}` : 'none',
        }}>
          <div style={{
            width: `${energyPct}%`,
            height: '100%',
            background: energyColor,
            borderRadius: 4,
            transition: 'width 0.1s ease, background 0.3s',
          }} />
        </div>

        {/* Lives */}
        <div style={{ display: 'flex', gap: 3 }}>
          {[0, 1, 2].map(i => (
            <span key={i} style={{
              fontSize: 14,
              opacity: i < lives ? 1 : 0.25,
              filter: i < lives ? 'none' : 'grayscale(1)',
            }}>🐱</span>
          ))}
        </div>
      </div>

      {/* Top-right: score + mice */}
      <div style={{
        position: 'absolute',
        top: 12,
        right: 14,
        textAlign: 'right',
        color: 'rgba(255,255,255,0.9)',
        textShadow: '0 1px 3px rgba(0,0,0,0.7)',
      }}>
        <div style={{ fontSize: 16, fontWeight: 'bold', letterSpacing: 1 }}>
          {score.toLocaleString()}
        </div>
        {miceCaught > 0 && (
          <div style={{ fontSize: 11, opacity: 0.8, marginTop: 2 }}>
            🐭 × {miceCaught}
          </div>
        )}
      </div>

      {/* Night indicator dot (subtle, not announced) */}
      {isNight && (
        <div style={{
          position: 'absolute',
          top: 14,
          left: '50%',
          transform: 'translateX(-50%)',
          fontSize: 10,
          opacity: 0.4,
        }}>🌙</div>
      )}

      <style>{`
        @keyframes pulse-red {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }
        @keyframes pulse-amber {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.75; }
        }
      `}</style>
    </div>
  );
}

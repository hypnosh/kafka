// RunSummary.jsx — post-run screen

import { useGameStore } from '../game/store';

export default function RunSummary() {
  const { phase, lastRun, lifetimeScore, highScore, lives } = useGameStore();

  if (phase !== 'summary' || !lastRun) return null;

  const { score, distance, miceCaught, cause, isNight } = lastRun;
  const quality = cause === 'vehicle' ? '😵' : score > 500 ? '😺' : '😿';

  const handlePlay = () => {
    useGameStore.getState().startRun();
    // Reset fade
    window.location.reload(); // simple for now — will refine in later sprint
  };

  return (
    <div style={{
      position: 'absolute',
      inset: 0,
      background: isNight ? 'rgba(5,5,20,0.92)' : 'rgba(20,20,30,0.88)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'monospace',
      color: 'rgba(255,255,255,0.9)',
      zIndex: 50,
    }}>
      <div style={{ textAlign: 'center', maxWidth: 320 }}>
        <div style={{ fontSize: 48, marginBottom: 8 }}>{quality}</div>

        <div style={{ fontSize: 28, fontWeight: 'bold', marginBottom: 4 }}>
          {score.toLocaleString()}
        </div>

        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginBottom: 20, letterSpacing: 1 }}>
          {isNight ? '🌙' : '☀️'} &nbsp; {Math.floor(distance)}m &nbsp;·&nbsp; 🐭 × {miceCaught}
        </div>

        <div style={{
          borderTop: '1px solid rgba(255,255,255,0.1)',
          paddingTop: 16,
          marginBottom: 20,
          fontSize: 11,
          color: 'rgba(255,255,255,0.4)',
        }}>
          lifetime &nbsp;
          <span style={{ color: 'rgba(255,220,100,0.8)', fontWeight: 'bold' }}>
            {lifetimeScore.toLocaleString()}
          </span>
        </div>

        <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginBottom: 24 }}>
          {[0, 1, 2].map(i => (
            <span key={i} style={{
              fontSize: 18,
              opacity: i < lives ? 1 : 0.2,
              filter: i < lives ? 'none' : 'grayscale(1)',
            }}>🐱</span>
          ))}
        </div>

        <button
          onClick={handlePlay}
          style={{
            background: 'rgba(255,255,255,0.1)',
            border: '1px solid rgba(255,255,255,0.2)',
            color: 'rgba(255,255,255,0.8)',
            padding: '10px 32px',
            borderRadius: 3,
            fontFamily: 'monospace',
            fontSize: 13,
            cursor: 'pointer',
            letterSpacing: 1,
          }}
        >
          run again
        </button>
      </div>
    </div>
  );
}

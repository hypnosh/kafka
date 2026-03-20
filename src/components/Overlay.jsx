// Overlay.jsx — desktop key guide, first launch only

import { useEffect, useState } from 'react';
import { useGameStore } from '../game/store';

const KEYS = [
  ['← →',    'Move. Left slows Kafka; world never scrolls left.'],
  ['↑',       'Climb — fences, drainpipes, fire escapes.'],
  ['↓',       'Crouch / squeeze through gaps.'],
  ['Space',   'Jump. Hold to charge — longer arc. Tap = hop.'],
  ['Z',       'Scratch (tap) or Pounce (hold + direction).'],
  ['X',       'Hiss — area stun, costs energy.'],
  ['Z + Z',   'Also hiss — one-handed fallback.'],
  ['Esc',     'Pause.'],
];

export default function Overlay() {
  const [visible, setVisible] = useState(false);
  const { phase } = useGameStore();

  useEffect(() => {
    const shown = localStorage.getItem('firstLaunch') === 'done';
    const isMobile = window.matchMedia('(pointer: coarse)').matches;
    if (!shown && !isMobile && phase === 'intro') {
      setVisible(true);
    }
  }, [phase]);

  useEffect(() => {
    if (!visible) return;
    const dismiss = () => {
      setVisible(false);
      localStorage.setItem('firstLaunch', 'done');
    };
    window.addEventListener('keydown', dismiss, { once: true });
    return () => window.removeEventListener('keydown', dismiss);
  }, [visible]);

  if (!visible) return null;

  return (
    <div style={{
      position: 'absolute',
      inset: 0,
      background: 'rgba(0,0,0,0.72)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 100,
      fontFamily: 'monospace',
    }}>
      <div style={{
        maxWidth: 440,
        width: '90%',
        padding: '28px 32px',
        background: 'rgba(10,10,20,0.9)',
        borderRadius: 4,
        border: '1px solid rgba(255,255,255,0.1)',
      }}>
        <div style={{
          color: 'rgba(255,255,255,0.9)',
          fontSize: 13,
          lineHeight: 1.8,
        }}>
          {KEYS.map(([key, desc]) => (
            <div key={key} style={{ display: 'flex', gap: 16, marginBottom: 6 }}>
              <span style={{
                minWidth: 60,
                color: 'rgba(255,220,100,0.9)',
                fontWeight: 'bold',
                fontSize: 12,
              }}>{key}</span>
              <span style={{ color: 'rgba(200,200,200,0.75)', fontSize: 12 }}>{desc}</span>
            </div>
          ))}
        </div>
        <div style={{
          marginTop: 20,
          paddingTop: 16,
          borderTop: '1px solid rgba(255,255,255,0.08)',
          color: 'rgba(255,255,255,0.35)',
          fontSize: 11,
          textAlign: 'center',
          letterSpacing: 1,
        }}>
          press any key to begin
        </div>
      </div>
    </div>
  );
}

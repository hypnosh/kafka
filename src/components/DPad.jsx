// DPad.jsx — mobile touch controls

import { useRef } from 'react';

const BTN = ({ label, onStart, onEnd, style }) => (
  <div
    onTouchStart={(e) => { e.preventDefault(); onStart?.(); }}
    onTouchEnd={(e) => { e.preventDefault(); onEnd?.(); }}
    onMouseDown={onStart}
    onMouseUp={onEnd}
    style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      userSelect: 'none',
      cursor: 'pointer',
      fontSize: 16,
      ...style,
    }}
  >
    {label}
  </div>
);

export default function DPad({ inputRef }) {
  const held = useRef({});

  const press = (key) => {
    if (held.current[key]) return;
    held.current[key] = true;
    inputRef?.current?.setTouch(key, true);
    if (key === 'jumpHeld') inputRef?.current?.setTouch('jumpPressed', true);
    if (key === 'attackHeld') inputRef?.current?.setTouch('attackPressed', true);
  };

  const release = (key) => {
    held.current[key] = false;
    inputRef?.current?.setTouch(key, false);
  };

  const dpadSize = 110;
  const btnR = 42;

  return (
    <div style={{
      position: 'absolute',
      bottom: 20,
      left: 0,
      right: 0,
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-end',
      padding: '0 16px',
      pointerEvents: 'none',
    }}>
      {/* Left: directional */}
      <div style={{
        width: dpadSize,
        height: dpadSize,
        position: 'relative',
        opacity: 0.3,
        pointerEvents: 'auto',
      }}>
        {/* Left arrow */}
        <BTN label="◀" onStart={() => press('left')} onEnd={() => release('left')} style={{
          position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)',
          width: 36, height: 36, background: 'rgba(255,255,255,0.15)', borderRadius: 8,
        }} />
        {/* Right arrow */}
        <BTN label="▶" onStart={() => press('right')} onEnd={() => release('right')} style={{
          position: 'absolute', right: 0, top: '50%', transform: 'translateY(-50%)',
          width: 36, height: 36, background: 'rgba(255,255,255,0.15)', borderRadius: 8,
        }} />
        {/* Down arrow */}
        <BTN label="▼" onStart={() => press('down')} onEnd={() => release('down')} style={{
          position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%)',
          width: 36, height: 36, background: 'rgba(255,255,255,0.15)', borderRadius: 8,
        }} />
      </div>

      {/* Right: action buttons */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        gap: 10,
        opacity: 0.3,
        pointerEvents: 'auto',
      }}>
        {/* Jump — largest */}
        <BTN label="↑" onStart={() => press('jumpHeld')} onEnd={() => release('jumpHeld')} style={{
          width: btnR + 10, height: btnR + 10,
          background: 'rgba(100,200,255,0.2)',
          borderRadius: '50%',
          border: '1.5px solid rgba(255,255,255,0.3)',
        }} />
        <div style={{ display: 'flex', gap: 10 }}>
          {/* Attack */}
          <BTN label="Z" onStart={() => press('attackHeld')} onEnd={() => release('attackHeld')} style={{
            width: btnR, height: btnR,
            background: 'rgba(255,180,100,0.2)',
            borderRadius: '50%',
            border: '1.5px solid rgba(255,255,255,0.25)',
          }} />
          {/* Hiss — smallest */}
          <BTN label="X" onStart={() => inputRef?.current?.setTouch('hissPressed', true)} onEnd={() => {}} style={{
            width: btnR - 10, height: btnR - 10,
            background: 'rgba(255,100,100,0.2)',
            borderRadius: '50%',
            border: '1.5px solid rgba(255,255,255,0.2)',
          }} />
        </div>
      </div>
    </div>
  );
}

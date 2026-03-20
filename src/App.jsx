// App.jsx — root component, assembles canvas + overlays

import { useRef } from 'react';
import Game from './components/Game';
import HUD from './components/HUD';
import DPad from './components/DPad';
import Overlay from './components/Overlay';
import RunSummary from './components/RunSummary';
import { useGameStore } from './game/store';

export default function App() {
  const inputRef = useRef(null);
  const { phase } = useGameStore();
  const isMobile = window.matchMedia('(pointer: coarse)').matches;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      overflow: 'hidden',
      background: '#0a0a1e',
    }}>
      {/* Canvas layer */}
      <Game inputRef={inputRef} />

      {/* React overlays */}
      <HUD />
      <Overlay />
      <RunSummary />

      {/* Mobile d-pad */}
      {isMobile && phase === 'running' && (
        <DPad inputRef={inputRef} />
      )}
    </div>
  );
}

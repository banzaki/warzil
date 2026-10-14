import { useEffect, useState } from 'react';
import Caricature from './Caricature.jsx';
import { FACTIONS } from '../game/data.js';

// The button only works after a short pause, so a tap meant for the previous
// turn does not skip the hand-over by accident.
const ARM_MS = 900;

// Hotseat: covers the board until the next person takes the device.
export default function Handoff({ faction, name, onReady }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    setArmed(false);
    const timer = setTimeout(() => setArmed(true), ARM_MS);
    return () => clearTimeout(timer);
  }, [faction]);

  return (
    <div className="overlay handoff" role="dialog" aria-modal="true" aria-labelledby="handoff-title">
      <div className={`handoff-card ${faction}`}>
        <Caricature who={faction} mood="happy" size={110} />
        <h2 id="handoff-title">Passe o dispositivo!</h2>
        <p>
          Agora é a vez de <b>{FACTIONS[faction].name}</b>
          {name ? ` (${name})` : ''}.
        </p>
        <button className="btn primary" disabled={!armed} onClick={onReady} autoFocus>
          Estou pronto
        </button>
        <small>O mapa aparece quando você confirmar.</small>
      </div>
    </div>
  );
}

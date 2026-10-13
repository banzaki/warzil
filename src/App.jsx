import { useState } from 'react';
import StartScreen from './components/StartScreen.jsx';
import GameScreen from './components/GameScreen.jsx';
import SimulationScreen from './components/SimulationScreen.jsx';
import { createGame } from './game/engine.js';

export default function App() {
  const [game, setGame] = useState(null);
  // Candidates chosen for an AI-vs-AI simulation (null when not simulating).
  const [simFactions, setSimFactions] = useState(null);
  // Extra candidates invited from "+ Mais candidatos"; kept when returning to the menu.
  const [invited, setInvited] = useState([]);
  // Bumping the key gives a rematch a completely fresh screen.
  const [matchId, setMatchId] = useState(0);

  const start = (human, rivals) => {
    setGame(createGame(human, Math.random, rivals));
    setMatchId((n) => n + 1);
  };
  const toMenu = () => {
    setGame(null);
    setSimFactions(null);
  };

  if (simFactions) return <SimulationScreen key={matchId} factions={simFactions} onMenu={toMenu} />;

  if (!game) {
    return (
      <StartScreen
        invited={invited}
        onInvitedChange={setInvited}
        onPick={start}
        onSimulate={(factions) => {
          setSimFactions(factions);
          setMatchId((n) => n + 1);
        }}
      />
    );
  }

  return (
    <GameScreen
      key={matchId}
      initialGame={game}
      onRematch={() => start(game.human, game.factions.slice(1))}
      onChangeCandidate={toMenu}
    />
  );
}

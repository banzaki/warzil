import { useState } from 'react';
import StartScreen from './components/StartScreen.jsx';
import GameScreen from './components/GameScreen.jsx';
import { createGame } from './game/engine.js';

export default function App() {
  const [game, setGame] = useState(null);
  // Extra candidates invited from "+ Mais candidatos"; kept when returning to the menu.
  const [invited, setInvited] = useState([]);
  // Bumping the key gives a rematch a completely fresh GameScreen.
  const [matchId, setMatchId] = useState(0);

  const start = (human, rivals) => {
    setGame(createGame(human, Math.random, rivals));
    setMatchId((n) => n + 1);
  };

  if (!game) return <StartScreen invited={invited} onInvitedChange={setInvited} onPick={start} />;

  return (
    <GameScreen
      key={matchId}
      initialGame={game}
      onRematch={() => start(game.human, game.factions.slice(1))}
      onChangeCandidate={() => setGame(null)}
    />
  );
}

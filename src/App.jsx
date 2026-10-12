import { useState } from 'react';
import StartScreen from './components/StartScreen.jsx';
import GameScreen from './components/GameScreen.jsx';
import { createGame } from './game/engine.js';

export default function App() {
  const [game, setGame] = useState(null);
  // Bumping the key gives a rematch a completely fresh GameScreen.
  const [matchId, setMatchId] = useState(0);

  const start = (faction) => {
    setGame(createGame(faction));
    setMatchId((n) => n + 1);
  };

  if (!game) return <StartScreen onPick={start} />;

  return (
    <GameScreen
      key={matchId}
      initialGame={game}
      onRematch={() => start(game.human)}
      onChangeCandidate={() => setGame(null)}
    />
  );
}

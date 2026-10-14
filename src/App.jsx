import { useEffect, useState } from 'react';
import StartScreen from './components/StartScreen.jsx';
import GameScreen from './components/GameScreen.jsx';
import SimulationScreen from './components/SimulationScreen.jsx';
import OnlineScreen from './components/OnlineScreen.jsx';
import { loadSession } from './online/client.js';
import { normalizeCode } from '../worker/codes.js';
import { createGame } from './game/engine.js';
import { loadSettings, resetSettings, saveSettings } from './game/settings.js';
import { setMuted } from './game/sound.js';
import {
  createDailyGame,
  dailyChallenge,
  dailyKey,
  dayRecord,
  loadDailyRecords,
  recordAttempt,
  recordResult,
  saveDailyRecords,
} from './game/daily.js';

export default function App() {
  const [game, setGame] = useState(null);
  // Candidates chosen for an AI-vs-AI simulation (null when not simulating).
  const [simFactions, setSimFactions] = useState(null);
  // Extra candidates invited from "+ Mais candidatos"; kept when returning to the menu.
  const [invited, setInvited] = useState([]);
  // Bumping the key gives a rematch a completely fresh screen.
  const [matchId, setMatchId] = useState(0);
  const [settings, setSettings] = useState(loadSettings);
  // Online rooms: opened from the menu or directly by an invite link (?sala=CODE).
  const [inviteCode] = useState(() => normalizeCode(new URLSearchParams(window.location.search).get('sala')) || null);
  // A saved session (reload during a match) reopens the room automatically.
  const [online, setOnline] = useState(() => Boolean(inviteCode) || Boolean(loadSession()));
  // Start-of-match deal for Lula vs. Flávio duels: 'random' (default) or 'polarized'.
  const [deal, setDeal] = useState('random');
  const [dailyRecords, setDailyRecords] = useState(loadDailyRecords);

  useEffect(() => {
    setMuted(!settings.sound);
    document.documentElement.classList.toggle('reduce-motion', settings.animations === 'reduced');
  }, [settings]);

  // Props for the gear button on every screen.
  const prefs = {
    settings,
    onChange: (next) => setSettings(saveSettings(next)),
    onReset: () => setSettings(resetSettings()),
  };

  const start = (human, rivals) => {
    setGame(createGame(human, Math.random, rivals, { deal, armies: settings.armies }));
    setMatchId((n) => n + 1);
  };
  // Daily challenge: same line-up and deal for everybody on that day (key = date).
  const startDaily = (key = dailyKey()) => {
    setDailyRecords((r) => saveDailyRecords(recordAttempt(r, key)));
    setGame(createDailyGame(dailyChallenge(key)));
    setMatchId((n) => n + 1);
  };
  const onMatchEnd = (finished) => {
    if (!finished.daily) return;
    const result = { won: finished.winner === finished.human, rounds: finished.round };
    setDailyRecords((r) => saveDailyRecords(recordResult(r, finished.daily, result)));
  };
  const toMenu = () => {
    setGame(null);
    setSimFactions(null);
  };

  if (online) {
    return (
      <OnlineScreen
        initialCode={inviteCode}
        prefs={prefs}
        onExit={() => {
          setOnline(false);
          if (inviteCode) window.history.replaceState(null, '', '/');
        }}
      />
    );
  }

  if (simFactions) return <SimulationScreen key={matchId} factions={simFactions} onMenu={toMenu} prefs={prefs} />;

  if (!game) {
    return (
      <StartScreen
        invited={invited}
        onInvitedChange={setInvited}
        deal={deal}
        onDealChange={setDeal}
        onPick={start}
        prefs={prefs}
        onOnline={() => setOnline(true)}
        daily={{ challenge: dailyChallenge(), record: dayRecord(dailyRecords, dailyKey()), onPlay: () => startDaily() }}
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
      onRematch={() => (game.daily ? startDaily(game.daily) : start(game.human, game.factions.filter((f) => f !== game.human)))}
      onMatchEnd={onMatchEnd}
      dailyRecord={game.daily ? dayRecord(dailyRecords, game.daily) : null}
      onChangeCandidate={toMenu}
      prefs={prefs}
    />
  );
}

import { useEffect, useState } from 'react';
import StartScreen from './components/StartScreen.jsx';
import GameScreen from './components/GameScreen.jsx';
import SimulationScreen from './components/SimulationScreen.jsx';
import OnlineScreen from './components/OnlineScreen.jsx';
import { loadSession } from './online/client.js';
import { normalizeCode } from '../worker/codes.js';
import { createGame } from './game/engine.js';
import { createLocalGame, localPlayers } from './game/hotseat.js';
import { track } from './game/metrics.js';
import { capturePageview, setAnalyticsEnabled, startMatch } from './game/analytics.js';
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
  // Opponents chosen in the menu; kept when returning to it.
  const [rivals, setRivals] = useState([]);
  // Menu step to open on: 'mode', or 'candidate' after "Trocar candidato".
  const [menuStep, setMenuStep] = useState('mode');
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
  // Local multiplayer: seats set up in the menu, and who plays the running match.
  const [localSeats, setLocalSeats] = useState([
    { faction: 'lula', human: true, nick: '' },
    { faction: 'flavio', human: true, nick: '' },
  ]);
  const [hotseat, setHotseat] = useState(null);
  // Analytics record of the running match (see analytics.js).
  const [match, setMatch] = useState(null);

  useEffect(() => {
    setAnalyticsEnabled(settings.analytics);
    capturePageview();
  }, [settings.analytics]);

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

  const start = (human, opponents, matchDeal = deal, rematch = false) => {
    track(rematch ? 'solo_rematch' : 'solo_start');
    setHotseat(null);
    const next = createGame(human, Math.random, opponents, { deal: matchDeal, armies: settings.armies });
    setGame(next);
    setMatch(startMatch({ mode: 'solo', candidate: human, participants: next.factions.length, humans: 1, ai: opponents.length, armies: String(next.armies), deal: next.deal, rematch }));
    setMatchId((n) => n + 1);
  };
  // Rematches keep the same seats; the engine draws a new order.
  const startLocal = (seats, matchDeal, rematch = false) => {
    track(rematch ? 'local_rematch' : 'local_start');
    setHotseat({ ...localPlayers(seats), seats, deal: matchDeal });
    const next = createLocalGame(seats, Math.random, { deal: matchDeal, armies: settings.armies });
    setGame(next);
    const people = seats.filter((s) => s.human);
    setMatch(
      startMatch({
        mode: 'local',
        candidates: people.map((s) => s.faction).join(','),
        participants: seats.length,
        humans: people.length,
        ai: seats.length - people.length,
        armies: String(next.armies),
        deal: next.deal,
        rematch,
      }),
    );
    setMatchId((n) => n + 1);
  };
  // Daily challenge: same line-up and deal for everybody on that day (key = date).
  const startDaily = (key = dailyKey(), rematch = false) => {
    track(rematch ? 'solo_rematch' : 'solo_start');
    setDailyRecords((r) => saveDailyRecords(recordAttempt(r, key)));
    const next = createDailyGame(dailyChallenge(key));
    setGame(next);
    setMatch(startMatch({ mode: 'daily', candidate: next.human, participants: next.factions.length, humans: 1, ai: next.factions.length - 1, armies: String(next.armies), deal: next.deal, rematch }));
    setMatchId((n) => n + 1);
  };
  const onMatchEnd = (finished) => {
    track(hotseat ? 'local_end' : 'solo_end');
    if (!finished.daily) return;
    const result = { won: finished.winner === finished.human, rounds: finished.round };
    setDailyRecords((r) => saveDailyRecords(recordResult(r, finished.daily, result)));
  };
  const toMenu = () => {
    setMenuStep(hotseat ? 'local' : game && !game.daily ? 'candidate' : 'mode');
    setHotseat(null);
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

  if (simFactions) return <SimulationScreen key={matchId} factions={simFactions} onMenu={toMenu} prefs={prefs} match={match} />;

  if (!game) {
    return (
      <StartScreen
        step={menuStep}
        rivals={rivals}
        onRivalsChange={setRivals}
        deal={deal}
        onDealChange={setDeal}
        onPick={start}
        prefs={prefs}
        onOnline={() => setOnline(true)}
        localSeats={localSeats}
        onLocalSeatsChange={setLocalSeats}
        onLocal={startLocal}
        daily={{ challenge: dailyChallenge(), record: dayRecord(dailyRecords, dailyKey()), onPlay: () => startDaily() }}
        onSimulate={(factions) => {
          setMatch(startMatch({ mode: 'simulation', participants: factions.length, humans: 0, ai: factions.length, armies: String(settings.armies) }));
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
      hotseat={hotseat}
      match={match}
      onRematch={() =>
        hotseat
          ? startLocal(hotseat.seats, hotseat.deal, true)
          : game.daily
            ? startDaily(game.daily, true)
            : start(game.human, game.factions.filter((f) => f !== game.human), deal, true)
      }
      onMatchEnd={onMatchEnd}
      dailyRecord={game.daily ? dayRecord(dailyRecords, game.daily) : null}
      onChangeCandidate={toMenu}
      prefs={prefs}
    />
  );
}

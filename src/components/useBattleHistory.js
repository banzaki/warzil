import { useEffect, useState } from 'react';
import { recordBattle } from '../game/battles.js';

// Every dice exchange this screen saw, newest first (see battles.js).
// storageKey (online matches): kept in this tab, so a reload mid-match keeps it.
export default function useBattleHistory(game, storageKey) {
  const [list, setList] = useState(() => {
    let saved = [];
    try {
      const raw = storageKey ? JSON.parse(sessionStorage.getItem(storageKey) ?? 'null') : null;
      if (Array.isArray(raw)) saved = raw;
    } catch {
      // No storage: the history starts now.
    }
    return recordBattle(saved, game.lastRoll, game.round);
  });
  useEffect(() => {
    setList((l) => recordBattle(l, game.lastRoll, game.round));
  }, [game.lastRoll?.id]);
  useEffect(() => {
    if (!storageKey) return;
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(list));
    } catch {
      // ignore
    }
  }, [list, storageKey]);
  return list;
}

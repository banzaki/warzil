import { useEffect, useRef, useState } from 'react';
import { describeEvent } from '../game/texts.js';
import { PRIORITY, enqueue, readMs, takeNext } from '../game/speech.js';

// The line on screen now (an event, or null): one at a time, each for as long as
// it takes to read, the most important first (see speech.js). The match never
// waits for it.
export default function useSpeechQueue(game, choose) {
  const speaks = (e) => Boolean(e) && PRIORITY[e.type] !== undefined && Boolean(describeEvent(e, choose).text);
  const [current, setCurrent] = useState(() => (speaks(game.log[0]) ? game.log[0] : null));
  const until = useRef(current ? Date.now() + readMs(describeEvent(current, choose).text) : 0);
  const queue = useRef([]);
  const seen = useRef(game.log[0]?.id ?? 0);
  const [tick, setTick] = useState(0);

  const latestId = game.log[0]?.id ?? 0;
  useEffect(() => {
    if (latestId <= seen.current) return;
    const fresh = game.log.filter((e) => e.id > seen.current).reverse();
    seen.current = latestId;
    queue.current = enqueue(queue.current, fresh.filter(speaks));
    setTick((t) => t + 1);
  }, [latestId]);

  useEffect(() => {
    const now = Date.now();
    if (current && now < until.current) {
      const timer = setTimeout(() => setTick((t) => t + 1), until.current - now);
      return () => clearTimeout(timer);
    }
    const [next, rest] = takeNext(queue.current);
    queue.current = rest;
    if (next) {
      until.current = now + readMs(describeEvent(next, choose).text);
      setCurrent(next);
    } else if (current) setCurrent(null);
    return undefined;
  }, [tick, current]);

  return current;
}

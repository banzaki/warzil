// Browser side of the online rooms: HTTP calls, the saved session and the
// WebSocket connection (with automatic reconnection).
import { useCallback, useEffect, useRef, useState } from 'react';
import { trackConnError } from '../game/metrics.js';
import { analyticsId } from '../game/analytics.js';

const SESSION_KEY = 'warzil-online';
const NICK_KEY = 'warzil-nick';

function storage() {
  try {
    return localStorage;
  } catch {
    return null;
  }
}

export function loadSession() {
  try {
    return JSON.parse(storage()?.getItem(SESSION_KEY) ?? 'null');
  } catch {
    return null;
  }
}

export function saveSession(session) {
  try {
    if (session) storage()?.setItem(SESSION_KEY, JSON.stringify(session));
    else storage()?.removeItem(SESSION_KEY);
  } catch {
    // Without storage, a reload just asks to join again.
  }
}

export const loadNick = () => {
  try {
    return storage()?.getItem(NICK_KEY) ?? '';
  } catch {
    return '';
  }
};

export const saveNick = (nick) => {
  try {
    storage()?.setItem(NICK_KEY, nick);
  } catch {
    // Not important.
  }
};

export const inviteLink = (code) => `${window.location.origin}/?sala=${code}`;

export const ERRORS = {
  nick: 'Escolha um apelido.',
  'nick-taken': 'Esse apelido já está na sala. Escolha outro.',
  full: 'A sala está cheia.',
  started: 'A partida dessa sala já começou.',
  'no-room': 'Sala não encontrada. Confira o código.',
  'rate-limited': 'Muitas salas criadas a partir desta conexão. Tente de novo em alguns minutos.',
  'join-limited': 'Muitas tentativas com códigos errados. Espere alguns minutos e confira o código ou use o link do convite.',
  covered: 'A IA está jogando por você. Toque em "Retomar" para voltar a jogar.',
  'faction-taken': 'Esse candidato já foi escolhido por outra pessoa.',
  'pick-first': 'Todos precisam escolher um candidato.',
  'need-two': 'São precisos pelo menos 2 participantes.',
  'host-only': 'Só o anfitrião pode fazer isso.',
  'not-your-turn': 'Ainda não é a sua vez.',
  illegal: 'Jogada não permitida.',
  network: 'Não foi possível falar com o servidor. Verifique a conexão.',
};
export const errorText = (code) => ERRORS[code] ?? 'Algo deu errado. Tente de novo.';

async function post(path, body) {
  try {
    const res = await fetch(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    return res.ok ? data : { error: data.error ?? 'network' };
  } catch {
    return { error: 'network' };
  }
}

// aid: anonymous analytics id, only when analytics is on (see analytics.js).
export const createRoom = (nick) => post('/api/rooms', { nick, aid: analyticsId() ?? undefined });
export const joinRoom = (code, nick) => post(`/api/rooms/${code}/join`, { nick, aid: analyticsId() ?? undefined });

// Live room view from the server. `status`: connecting | open | closed | gone.
export function useRoom(session) {
  const [view, setView] = useState(null);
  const [status, setStatus] = useState('connecting');
  const [error, setError] = useState(null);
  const wsRef = useRef(null);
  const seqRef = useRef(0);

  useEffect(() => {
    if (!session) return undefined;
    let stopped = false;
    let failures = 0;
    let everOpened = false;
    let timer;
    const connect = () => {
      const scheme = window.location.protocol === 'https:' ? 'wss' : 'ws';
      // The token goes as a subprotocol, so it never appears in a URL.
      const ws = new WebSocket(`${scheme}://${window.location.host}/api/rooms/${session.code}/ws`, ['warzil', session.token]);
      wsRef.current = ws;
      setStatus('connecting');
      ws.onopen = () => {
        failures = 0;
        everOpened = true;
        setStatus('open');
      };
      ws.onmessage = (event) => {
        let msg;
        try {
          msg = JSON.parse(event.data);
        } catch {
          return;
        }
        if (msg.type === 'state') {
          seqRef.current = Math.max(seqRef.current, msg.room.yourSeq ?? 0);
          setView(msg.room);
        } else if (msg.type === 'error' && msg.error !== 'duplicate') {
          setError({ code: msg.error, at: Date.now() });
        }
      };
      ws.onclose = () => {
        if (stopped) return;
        failures += 1;
        trackConnError();
        // A room that never accepted us (expired, wrong token) is gone.
        if (!everOpened && failures >= 4) {
          setStatus('gone');
          return;
        }
        setStatus('closed');
        timer = setTimeout(connect, Math.min(10000, 800 * 2 ** failures));
      };
    };
    connect();
    const ping = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) wsRef.current.send('{"type":"ping"}');
    }, 25000);
    return () => {
      stopped = true;
      clearTimeout(timer);
      clearInterval(ping);
      wsRef.current?.close();
    };
  }, [session?.code, session?.token]);

  const send = useCallback((msg) => {
    const ws = wsRef.current;
    if (ws?.readyState !== WebSocket.OPEN) return false;
    ws.send(JSON.stringify(msg));
    return true;
  }, []);

  // Each action carries an increasing number; the server rejects repeats.
  const sendAction = useCallback(
    (action) => {
      seqRef.current += 1;
      return send({ type: 'action', action, seq: seqRef.current });
    },
    [send],
  );

  return { view, status, error, send, sendAction };
}

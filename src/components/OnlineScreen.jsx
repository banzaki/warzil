import { useEffect, useState } from 'react';
import Caricature from './Caricature.jsx';
import GameScreen from './GameScreen.jsx';
import { FACTIONS } from '../game/data.js';
import { CANDIDATES, DISCLAIMER } from '../game/texts.js';
import { createRoom, errorText, inviteLink, joinRoom, loadNick, loadSession, saveNick, saveSession, useRoom } from '../online/client.js';
import { CODE_LENGTH, LEGACY_CODE_LENGTH, formatCode, normalizeCode } from '../../worker/codes.js';

const FACTION_IDS = Object.keys(FACTIONS);
const MAX_PLAYERS = 4;
const ARMY_LABELS = [
  [1, '1 por estado'],
  [2, '2'],
  [3, '3'],
  ['mixed', 'Misturado (1–5)'],
];

// Entry: nickname, then create a room or join one by code / invite link. An
// invite fills in its room, but "Entrar em outra sala" opens the code field.
function Entry({ initialCode, onSession, onExit }) {
  const [nick, setNick] = useState(loadNick);
  const [code, setCode] = useState(initialCode ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [otherRoom, setOtherRoom] = useState(!initialCode);
  const validCode = [CODE_LENGTH, LEGACY_CODE_LENGTH].includes(normalizeCode(code).length);

  const go = async (kind) => {
    const clean = nick.trim();
    if (!clean) return setError(errorText('nick'));
    setBusy(true);
    setError(null);
    saveNick(clean);
    const res = kind === 'create' ? await createRoom(clean) : await joinRoom(normalizeCode(code), clean);
    setBusy(false);
    if (res.error) return setError(errorText(res.error));
    onSession({ code: res.code, token: res.token, playerId: res.playerId, nick: clean });
  };

  return (
    <main className="start online-entry">
      <header className="start-header">
        <h1 className="logo">
          WAR<span className="logo-zil">ZIL</span>
        </h1>
        <p className="subtitle">Jogar online</p>
        <p className="tagline">Salas privadas com amigos. Sem cadastro: só um apelido.</p>
      </header>
      <section className="online-card-box">
        <label className="field">
          <span>Seu apelido</span>
          <input value={nick} maxLength={16} onChange={(e) => setNick(e.target.value)} placeholder="Ex.: Bruno" autoFocus />
        </label>
        {!otherRoom ? (
          <>
            <button className="btn primary big" disabled={busy} onClick={() => go('join')}>
              Entrar na sala {formatCode(initialCode)}
            </button>
            <button
              className="btn ghost other-room"
              disabled={busy}
              onClick={() => {
                setError(null);
                setOtherRoom(true);
              }}
            >
              Entrar em outra sala
            </button>
          </>
        ) : (
          <>
            <button className="btn primary big" disabled={busy} onClick={() => go('create')}>
              ➕ Criar sala
            </button>
            <div className="or">ou entre com um código</div>
            <div className="join-row">
              <input
                value={code}
                maxLength={12}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                onFocus={(e) => e.target.select()}
                placeholder="ABCD-EFGH"
                aria-label="Código da sala"
                className="code-input"
                autoFocus={Boolean(initialCode)}
              />
              {code && (
                <button className="btn ghost code-clear" onClick={() => setCode('')} aria-label="Apagar o código">
                  ✕
                </button>
              )}
              <button className="btn primary" disabled={busy || !validCode} onClick={() => go('join')}>
                Entrar
              </button>
            </div>
            {code && !validCode && <p className="hint small">O código tem 8 letras e números, como ABCD-EFGH.</p>}
          </>
        )}
        {error && <p className="online-error">{error}</p>}
      </section>
      <button className="btn ghost quit online-back" onClick={onExit}>
        ⟲ Voltar ao menu
      </button>
      <footer className="disclaimer">{DISCLAIMER}</footer>
    </main>
  );
}

function Lobby({ view, send, onLeave }) {
  const me = view.players.find((p) => p.id === view.you);
  const isHost = view.hostId === view.you;
  const takenBy = Object.fromEntries(view.players.filter((p) => p.faction).map((p) => [p.faction, p]));
  const total = view.players.length + view.settings.aiCount;
  const everyonePicked = view.players.every((p) => p.faction);
  const [copied, setCopied] = useState(false);
  const link = inviteLink(view.code);

  const share = async () => {
    try {
      if (navigator.share) await navigator.share({ title: 'WARZIL', text: 'Bora uma partida de WARZIL?', url: link });
      else {
        await navigator.clipboard.writeText(link);
        setCopied(true);
      }
    } catch {
      // Cancelled; the link stays visible to copy by hand.
    }
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <main className="start online-lobby">
      <header className="start-header">
        <h1 className="logo small-logo">
          WAR<span className="logo-zil">ZIL</span>
        </h1>
        <p className="subtitle">Sala {formatCode(view.code)}</p>
      </header>

      <section className="online-card-box">
        <p className="invite-label">Convide os amigos com este link:</p>
        <p className="invite-link">{link}</p>
        <div className="buttons">
          <button className="btn primary" onClick={share}>
            📤 Convidar
          </button>
          <button className="btn ghost" onClick={copy}>
            {copied ? 'Link copiado ✓' : '📋 Copiar link'}
          </button>
        </div>
      </section>

      <section className="online-card-box">
        <h3>Jogadores ({view.players.length}/{MAX_PLAYERS})</h3>
        <ul className="lobby-players">
          {view.players.map((p) => (
            <li key={p.id} className={p.faction ?? ''}>
              {p.faction ? <Caricature who={p.faction} mood="happy" size={36} /> : <span className="no-face">?</span>}
              <b>{p.nick}</b>
              {p.id === view.hostId && <span className="tag">anfitrião</span>}
              {p.id === view.you && <span className="tag you">você</span>}
              <span className={`dot ${p.connected ? 'on' : ''}`} title={p.connected ? 'conectado' : 'desconectado'} />
              <small>{p.faction ? CANDIDATES[p.faction].name : 'escolhendo…'}</small>
            </li>
          ))}
          {Array.from({ length: view.settings.aiCount }, (_, i) => (
            <li key={`ai${i}`} className="ai">
              <span className="no-face">🤖</span>
              <b>IA</b>
              <small>candidato sorteado na hora</small>
            </li>
          ))}
        </ul>
      </section>

      <section className="online-card-box">
        <h3>Escolha seu candidato</h3>
        <div className="sim-picks lobby-picks">
          {FACTION_IDS.map((id) => {
            const owner = takenBy[id];
            const mine = owner?.id === view.you;
            return (
              <button
                key={id}
                className={`sim-pick ${id} ${mine ? 'on' : ''}`}
                aria-pressed={mine}
                disabled={owner && !mine}
                onClick={() => send({ type: 'pick', faction: mine ? null : id })}
              >
                <Caricature who={id} mood={mine ? 'happy' : 'neutral'} size={44} />
                <span>{CANDIDATES[id].name}</span>
                {owner && !mine && <small>{owner.nick}</small>}
              </button>
            );
          })}
        </div>
      </section>

      <section className="online-card-box">
        <h3>Configurações {isHost ? '' : '(o anfitrião escolhe)'}</h3>
        <div className="deal-choice">
          <span>Exércitos iniciais</span>
          <div className="chips" role="radiogroup" aria-label="Exércitos iniciais">
            {ARMY_LABELS.map(([value, label]) => (
              <button
                key={String(value)}
                role="radio"
                aria-checked={view.settings.armies === value}
                disabled={!isHost}
                className={`chip ${view.settings.armies === value ? 'on' : ''}`}
                onClick={() => send({ type: 'settings', settings: { armies: value } })}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="deal-choice">
          <span>Vagas completadas pela IA</span>
          <div className="chips" role="radiogroup" aria-label="Vagas com IA">
            {Array.from({ length: MAX_PLAYERS - view.players.length + 1 }, (_, n) => (
              <button
                key={n}
                role="radio"
                aria-checked={view.settings.aiCount === n}
                disabled={!isHost}
                className={`chip ${view.settings.aiCount === n ? 'on' : ''}`}
                onClick={() => send({ type: 'settings', settings: { aiCount: n } })}
              >
                {n === 0 ? 'Nenhuma' : `+${n} IA`}
              </button>
            ))}
          </div>
        </div>
      </section>

      {isHost ? (
        <button className="btn primary big start-online" disabled={!everyonePicked || total < 2} onClick={() => send({ type: 'start' })}>
          {total < 2 ? 'Aguardando mais jogadores…' : !everyonePicked ? 'Todos precisam escolher um candidato' : `▶ Começar com ${total} candidatos`}
        </button>
      ) : (
        <p className="waiting">{me?.faction ? 'Aguardando o anfitrião começar…' : 'Escolha seu candidato. O anfitrião começa a partida.'}</p>
      )}
      <button className="btn ghost quit online-back" onClick={onLeave}>
        ⟲ Sair da sala
      </button>
    </main>
  );
}

// Shown in the last COVER_WARNING_SECONDS before the AI covers the current player,
// and while it covers them. The server clock decides; `serverNow` corrects for a
// client clock that is off.
const COVER_WARNING_SECONDS = 30;

function CoverBanner({ view, names, onResume }) {
  const [, tick] = useState(0);
  const [receivedAt, setReceivedAt] = useState(() => Date.now());
  useEffect(() => setReceivedAt(Date.now()), [view]);
  useEffect(() => {
    const timer = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(timer);
  }, []);
  if (view.status !== 'playing') return null;
  const faction = view.game.current;
  const mine = view.controllers[faction] === view.you;
  const who = names[faction] ?? FACTIONS[faction].name;
  if (view.covering === faction) {
    return (
      <div className="cover-banner covering" role="status">
        {mine ? (
          <>
            🤖 A IA está jogando por você.
            <button className="btn primary" onClick={onResume}>
              Retomar
            </button>
          </>
        ) : (
          <>🤖 A IA está jogando por {who}.</>
        )}
      </div>
    );
  }
  if (!view.coverAt) return null;
  const left = Math.ceil((view.coverAt - view.serverNow - (Date.now() - receivedAt)) / 1000);
  if (left > COVER_WARNING_SECONDS || left < 0) return null;
  return (
    <div className="cover-banner" role="status">
      {mine ? `⏳ Sua vez! Em ${left}s a IA joga por você.` : `⏳ ${who}: em ${left}s a IA assume a vez.`}
    </div>
  );
}

// Online flow: entry -> lobby -> match, all in one place. `initialCode` comes from ?sala=CODE.
export default function OnlineScreen({ initialCode, prefs, onExit }) {
  const [session, setSession] = useState(() => {
    const saved = loadSession();
    return saved && (!initialCode || saved.code === initialCode) ? saved : null;
  });
  const { view, status, error, send, sendAction } = useRoom(session);
  const [toast, setToast] = useState(null);
  const [wasHost, setWasHost] = useState(null);

  // The host role can pass on (the host left or dropped); tell the new host.
  const isHost = view ? view.hostId === view.you : null;
  useEffect(() => {
    if (isHost === null) return undefined;
    setWasHost(isHost);
    if (wasHost !== false || !isHost) return undefined;
    setToast('Agora você é o anfitrião da sala.');
    const timer = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timer);
  }, [isHost]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!error) return undefined;
    setToast(errorText(error.code));
    const timer = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(timer);
  }, [error]);

  const leave = () => {
    send({ type: 'leave' });
    saveSession(null);
    setSession(null);
    onExit();
  };

  if (!session) {
    return (
      <Entry
        initialCode={initialCode}
        onExit={onExit}
        onSession={(s) => {
          saveSession(s);
          setSession(s);
          // Joined a different room than the invite: drop ?sala= so a reload reconnects to this one.
          if (initialCode && s.code !== initialCode) window.history.replaceState(null, '', '/');
        }}
      />
    );
  }

  if (status === 'gone') {
    return (
      <main className="start online-entry">
        <section className="online-card-box">
          <p>Essa sala não existe mais (as salas fecham depois de 2 horas sem atividade).</p>
          <button className="btn primary" onClick={leave}>
            Voltar ao menu
          </button>
        </section>
      </main>
    );
  }

  const banner = status !== 'open' && <div className="conn-banner">{view ? 'Reconectando…' : 'Conectando à sala…'}</div>;

  if (!view) return <main className="start online-entry">{banner}</main>;

  if (view.status === 'lobby') {
    return (
      <>
        {banner}
        {toast && <div className="online-toast">{toast}</div>}
        <Lobby view={view} send={send} onLeave={leave} />
      </>
    );
  }

  const me = view.players.find((p) => p.id === view.you);
  const names = Object.fromEntries(view.players.filter((p) => p.faction).map((p) => [p.faction, p.nick]));
  return (
    <>
      {banner}
      {toast && <div className="online-toast">{toast}</div>}
      <CoverBanner view={view} names={names} onResume={() => send({ type: 'resume' })} />
      <GameScreen
        key={`${view.code}-${view.matchNo}`}
        initialGame={view.game}
        prefs={prefs}
        online={{
          game: view.game,
          matchRef: view.matchRef,
          me: me?.faction,
          names,
          isHost: view.hostId === view.you,
          dispatch: sendAction,
          onRematch: () => send({ type: 'rematch' }),
          onLeave: leave,
        }}
      />
    </>
  );
}

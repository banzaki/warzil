import { useEffect, useState } from 'react';
import brazil from '@svg-maps/brazil';
import { publicUrl, shareText } from '../game/share.js';

const W = 1080;
const H = 1350;

// Faction colours come from the CSS variables, so the card matches the game.
function factionColors(faction) {
  const probe = document.createElement('span');
  probe.className = faction;
  document.body.appendChild(probe);
  const css = getComputedStyle(probe);
  const colors = { map: css.getPropertyValue('--c-map').trim(), soft: css.getPropertyValue('--c-soft').trim(), dark: css.getPropertyValue('--c-dark').trim() };
  probe.remove();
  return colors;
}

function svgImage(markup) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(new Blob([markup], { type: 'image/svg+xml' }));
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = reject;
    img.src = url;
  });
}

function mapMarkup(owner, colorOf) {
  const paths = brazil.locations
    .map((l) => `<path d="${l.path}" fill="${colorOf(owner[l.id]).map}" stroke="#fff" stroke-width="1.4" stroke-linejoin="round"/>`)
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${brazil.viewBox}" width="613" height="639">${paths}</svg>`;
}

function wrap(ctx, text, maxWidth) {
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

// Draws the 1080x1350 card and resolves with a PNG blob.
export async function renderCard(model, winnerSvg) {
  await document.fonts?.ready;
  const cache = {};
  const colorOf = (f) => (cache[f] ??= factionColors(f));
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  const bg = ctx.createRadialGradient(W * 0.3, H * 0.2, 50, W / 2, H / 2, H);
  bg.addColorStop(0, '#23407a');
  bg.addColorStop(1, '#14213d');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Logo
  ctx.textAlign = 'center';
  ctx.font = '120px Bungee, Impact, sans-serif';
  const war = ctx.measureText('WAR').width;
  const zil = ctx.measureText('ZIL').width;
  const left = W / 2 - (war + zil) / 2;
  ctx.textAlign = 'left';
  ctx.fillStyle = '#e53935';
  ctx.fillText('WAR', left, 150);
  ctx.fillStyle = '#1e88e5';
  ctx.fillText('ZIL', left + war, 150);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffca28';
  ctx.font = '40px Bungee, Impact, sans-serif';
  ctx.fillText('A GUERRA DOS VOTOS', W / 2, 210);

  // Winner caricature (the end-screen SVG, with its CSS colours resolved).
  const winner = colorOf(model.winner);
  const face = await svgImage(
    new XMLSerializer().serializeToString(winnerSvg).replaceAll('var(--c-soft)', winner.soft).replace(/width="\d+"/, 'width="300"').replace(/height="\d+"/, 'height="300"'),
  );
  ctx.drawImage(face, 60, 250, 300, 300);

  // Headline + quote, right of the face
  ctx.textAlign = 'left';
  ctx.fillStyle = '#fff';
  ctx.font = '64px Bungee, Impact, sans-serif';
  ctx.fillText(model.winnerName, 400, 330);
  ctx.font = 'bold 44px Nunito, system-ui, sans-serif';
  ctx.fillStyle = '#ffca28';
  ctx.fillText(model.simulation ? 'venceu a simulação!' : 'venceu a guerra!', 400, 390);
  ctx.fillStyle = '#e8ecf5';
  ctx.font = 'italic 600 32px Nunito, system-ui, sans-serif';
  wrap(ctx, `“${model.quote}”`, 620)
    .slice(0, 4)
    .forEach((line, i) => ctx.fillText(line, 400, 450 + i * 42));

  // Final map: fits the 540 px band between the quote and the stats, keeping the 613x639 ratio.
  const map = await svgImage(mapMarkup(model.owner, colorOf));
  const mapH = 540;
  const mapW = Math.round((mapH * 613) / 639);
  ctx.drawImage(map, (W - mapW) / 2, 615, mapW, mapH);

  // Stats ribbon
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.fillRect(60, 1170, W - 120, 70);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 36px Nunito, system-ui, sans-serif';
  const stats = [`${model.rounds} rodadas`, `${model.factionCount} candidatos`, model.daily ? `📅 Desafio ${model.daily}` : null].filter(Boolean).join('  ·  ');
  ctx.fillText(stats, W / 2, 1218);

  // Footer
  ctx.font = '600 26px Nunito, system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.fillText('Sátira fictícia. Caricaturas originais. Nenhum apoio a candidato ou partido.', W / 2, 1285);
  if (model.url) {
    ctx.fillStyle = '#ffca28';
    ctx.font = 'bold 30px Nunito, system-ui, sans-serif';
    ctx.fillText(model.url.replace(/^https?:\/\//, ''), W / 2, 1325);
  }

  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
}

// Share button + sheet with preview, native share when available, download and copy.
export default function ShareSheet({ model, faceSelector = '.winner-face' }) {
  const [open, setOpen] = useState(false);
  const [blob, setBlob] = useState(null);
  const [preview, setPreview] = useState(null);
  const [status, setStatus] = useState('');
  const url = publicUrl(import.meta.env.VITE_PUBLIC_URL, window.location.origin);
  const full = { ...model, url };
  const text = shareText(full);

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    let objectUrl = null;
    const svg = document.querySelector(`${faceSelector}`);
    renderCard(full, svg)
      .then((png) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(png);
        setBlob(png);
        setPreview(objectUrl);
      })
      .catch(() => !cancelled && setStatus('Não foi possível gerar a imagem neste navegador.'));
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [open]);

  const file = blob ? new File([blob], 'warzil-vitoria.png', { type: 'image/png' }) : null;
  const canShareFile = !!file && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] });

  const share = async () => {
    try {
      await navigator.share({ files: [file], text });
      setStatus('Compartilhado!');
    } catch {
      // Cancelled by the user or not allowed: the download/copy buttons stay available.
    }
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setStatus('Texto copiado.');
    } catch {
      setStatus('Não deu para copiar automaticamente; selecione o texto abaixo.');
    }
  };

  return (
    <>
      <button className="btn ghost share-open" onClick={() => setOpen(true)}>
        📤 Compartilhar
      </button>
      {open && (
        <div className="overlay share-overlay" role="dialog" aria-modal="true" aria-label="Compartilhar resultado" onClick={() => setOpen(false)}>
          <div className="share-card" onClick={(e) => e.stopPropagation()}>
            {preview ? <img className="share-preview" src={preview} alt="Cartão de vitória do WARZIL" /> : <p className="share-wait">Gerando cartão…</p>}
            <div className="buttons">
              {canShareFile && (
                <button className="btn primary" onClick={share}>
                  📤 Compartilhar
                </button>
              )}
              {preview && (
                <a className="btn primary" href={preview} download="warzil-vitoria.png">
                  ⬇ Baixar PNG
                </a>
              )}
              <button className="btn ghost" onClick={copy}>
                📋 Copiar texto
              </button>
            </div>
            <textarea className="share-text" readOnly value={text} rows={4} aria-label="Texto para compartilhar" />
            {status && <p className="share-status">{status}</p>}
            <button className="btn ghost" onClick={() => setOpen(false)}>
              Fechar
            </button>
          </div>
        </div>
      )}
    </>
  );
}

import { useEffect, useState } from 'react';

const ROWS = [
  {
    key: 'sound',
    label: 'Som',
    options: [
      [false, 'Desligado'],
      [true, 'Ligado'],
    ],
  },
  {
    key: 'animations',
    label: 'Animações',
    options: [
      ['normal', 'Normais'],
      ['reduced', 'Reduzidas'],
    ],
  },
  {
    key: 'aiSpeed',
    label: 'Velocidade da IA',
    options: [
      ['normal', 'Normal (1x)'],
      ['fast', 'Rápida (2x)'],
      ['veryFast', 'Muito rápida (4x)'],
    ],
  },
  {
    key: 'reinforce',
    label: 'Reforços por toque',
    hint: 'Volta a este padrão a cada novo comício. "Desfazer" sempre disponível.',
    options: [
      ['one', '+1'],
      ['five', '+5'],
      ['all', 'Tudo'],
      ['picker', 'Escolher'],
    ],
  },
];

// Gear button + small settings sheet. `settings`/`onChange` come from App.
export default function SettingsButton({ settings, onChange, onReset }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <>
      <button className="gear" aria-label="Configurações" title="Configurações" onClick={() => setOpen(true)}>
        ⚙️
      </button>
      {open && (
        <div className="overlay settings-overlay" role="dialog" aria-modal="true" aria-labelledby="settings-title" onClick={() => setOpen(false)}>
          <div className="settings-card" onClick={(e) => e.stopPropagation()}>
            <h2 id="settings-title">Configurações</h2>
            {ROWS.map((row) => (
              <div key={row.key} className="settings-row">
                <span className="settings-label">{row.label}</span>
                <div className="chips" role="radiogroup" aria-label={row.label}>
                  {row.options.map(([value, text]) => (
                    <button
                      key={String(value)}
                      role="radio"
                      aria-checked={settings[row.key] === value}
                      className={`chip ${settings[row.key] === value ? 'on' : ''}`}
                      onClick={() => onChange({ ...settings, [row.key]: value, ...(row.key === 'aiSpeed' ? { aiSpeedChosen: true } : {}) })}
                    >
                      {text}
                    </button>
                  ))}
                </div>
                {row.hint && <small className="settings-hint">{row.hint}</small>}
              </div>
            ))}
            <p className="settings-note">As configurações ficam salvas só neste navegador e não mudam as regras nem os dados.</p>
            <div className="buttons">
              <button className="btn ghost" onClick={onReset}>
                Restaurar padrões
              </button>
              <button className="btn primary" onClick={() => setOpen(false)} autoFocus>
                Pronto
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

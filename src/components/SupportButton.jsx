import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { PIX, SUPPORT_ENABLED, copyText } from '../game/support.js';

// "❤️ Apoie o WARZIL": a discreet button that opens the Pix modal.
export default function SupportButton({ className = '' }) {
  const [open, setOpen] = useState(false);
  if (!SUPPORT_ENABLED) return null;
  return (
    <>
      <button className={`btn ghost support-open ${className}`} onClick={() => setOpen(true)}>
        ❤️ Apoie o WARZIL
      </button>
      {/* Rendered on <body> so no animated or scrolling card around the button can clip it. */}
      {open && createPortal(<SupportModal onClose={() => setOpen(false)} />, document.body)}
    </>
  );
}

function SupportModal({ onClose }) {
  // Which text was just copied ('payload' or 'key'), or 'failed' to show it for manual copy.
  const [copied, setCopied] = useState(null);
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const copy = async (what) => setCopied((await copyText(what === 'key' ? PIX.key : PIX.payload)) ? what : 'failed');

  return (
    <div className="overlay support-overlay" role="dialog" aria-modal="true" aria-labelledby="support-title" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="support-card">
        <button className="support-close" onClick={onClose} aria-label="Fechar">
          ✕
        </button>
        <h2 id="support-title">Apoie o WARZIL</h2>
        <p>
          Curtiu conquistar o Brasil? O WARZIL é gratuito e independente. Se quiser ajudar a manter o jogo online e financiar melhorias, qualquer valor é
          bem-vindo!
        </p>
        <img className="support-qr" src={PIX.qr} width="200" height="200" alt="QR Code Pix para apoiar o WARZIL" />
        <small>Aponte a câmera do app do banco. O valor você escolhe na hora.</small>
        <div className="buttons support-copy">
          <button className="btn primary" onClick={() => copy('payload')}>
            {copied === 'payload' ? 'Copiado! ✓' : 'Copiar Pix Copia e Cola'}
          </button>
          <button className="btn ghost" onClick={() => copy('key')}>
            {copied === 'key' ? 'Chave copiada! ✓' : 'Copiar chave Pix'}
          </button>
        </div>
        {copied === 'failed' && (
          <label className="support-manual">
            Não deu para copiar automaticamente. Selecione e copie:
            <textarea readOnly value={PIX.payload} onFocus={(e) => e.target.select()} rows={3} />
          </label>
        )}
        <p className="support-note">O apoio é voluntário e não dá nenhuma vantagem no jogo.</p>
        <p className="support-note">Apoio ao desenvolvimento independente do jogo. Não é contribuição para candidato ou partido.</p>
      </div>
    </div>
  );
}

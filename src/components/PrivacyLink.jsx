import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { CONTACT_URL } from '../game/support.js';

// "Privacidade": what the game measures and how to turn it off.
export default function PrivacyLink() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);
  return (
    <>
      <button className="privacy-link" onClick={() => setOpen(true)}>
        Privacidade
      </button>
      {open &&
        createPortal(
          <div className="overlay support-overlay" role="dialog" aria-modal="true" aria-labelledby="privacy-title" onClick={(e) => e.target === e.currentTarget && setOpen(false)}>
            <div className="support-card privacy-card">
              <button className="support-close" onClick={() => setOpen(false)} aria-label="Fechar">
                ✕
              </button>
              <h2 id="privacy-title">Privacidade</h2>
              <p>
                O WARZIL não tem cadastro. Para saber como o jogo é usado e melhorá-lo, ele envia <b>estatísticas anônimas</b>: modo escolhido, candidato,
                duração e resultado das partidas, falhas técnicas do jogo, tipo de aparelho, país e de onde veio a visita (por exemplo, TikTok).
              </p>
              <p>
                Cada navegador recebe um código aleatório, guardado só nele. <b>Não coletamos</b> nome, apelido, e-mail, telefone, códigos de sala nem dados
                de pagamento, e o endereço IP não é guardado. Os dados ficam no PostHog, em servidores na União Europeia.
              </p>
              <p>
                Para desligar: ⚙️ Configurações → <b>Estatísticas anônimas</b>. Navegadores com Global Privacy Control já ficam de fora.
              </p>
              <p>O apoio por Pix acontece no app do seu banco: o jogo não recebe nenhum dado do pagamento.</p>
              <p className="support-note">
                Dúvidas:{' '}
                <a href={CONTACT_URL} target="_blank" rel="noreferrer">
                  Fale com o criador
                </a>
              </p>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

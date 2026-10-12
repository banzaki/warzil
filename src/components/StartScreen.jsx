import Caricature from './Caricature.jsx';
import { CANDIDATES, DISCLAIMER } from '../game/texts.js';

export default function StartScreen({ onPick }) {
  return (
    <main className="start">
      <header className="start-header">
        <h1 className="logo">
          WAR<span className="logo-zil">ZIL</span>
        </h1>
        <p className="subtitle">A Guerra dos Votos</p>
        <p className="tagline">Conquiste os 27 estados. Um dado de cada vez.</p>
      </header>

      <h2 className="choose">Escolha seu candidato</h2>
      <div className="candidates">
        {['lula', 'flavio'].map((id) => (
          <button key={id} className={`candidate-card ${id}`} onClick={() => onPick(id)}>
            <Caricature who={id} mood="happy" size={130} />
            <span className="candidate-name">{CANDIDATES[id].name}</span>
            <span className="candidate-title">{CANDIDATES[id].title}</span>
            <span className="candidate-pitch">{CANDIDATES[id].pitch}</span>
            <span className="candidate-cta">Jogar de {CANDIDATES[id].name}</span>
          </button>
        ))}
      </div>

      <section className="how">
        <h3>Como jogar</h3>
        <ol>
          <li><b>Comício:</b> coloque seus reforços nos seus estados.</li>
          <li><b>Batalha:</b> ataque vizinhos quantas vezes quiser, com até 3 dados. Empate é da defesa.</li>
          <li><b>Movimentação:</b> cada estado envia exércitos uma vez por turno. Quem chega não sai de novo.</li>
        </ol>
        <p>Domine uma região inteira para ganhar tropas bônus. Tome todos os estados para vencer.</p>
      </section>

      <footer className="disclaimer">
        {DISCLAIMER}
        <br />
        Mapa:{' '}
        <a href="https://github.com/VictorCazanave/svg-maps" target="_blank" rel="noreferrer">
          svg-maps
        </a>{' '}
        de Victor Cazanave (CC BY 4.0).
      </footer>
    </main>
  );
}

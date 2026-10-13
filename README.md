# WARZIL — A Guerra dos Votos

A casual, satirical territory-strategy game (Risk-style) on the map of Brazil.
Fictional satire with original caricatures. No endorsement of any candidate or party.

## Run locally

```bash
npm install
npm run dev      # then open http://localhost:5173
```

Other scripts:

- `npm test` – rules and AI tests (Node's built-in test runner, includes 200 full AI-vs-AI games)
- `npm run build` / `npm run preview` – production build

## How to play

1. **Rally** – place reinforcements (half your state count, min. 3, plus region bonuses).
2. **Debate** – attack neighbouring enemy states. Attacker rolls up to 3 dice, defender up to 2;
   highest dice are compared and ties go to the defender.
3. **Regroup** – optionally move troops once between two neighbouring states, then end the turn.

"Simular guerra" on the start screen runs an AI-vs-AI match (2–4 candidates) with pause and 1x/2x/4x speed.

Be the last faction standing to win. Default match: Lula vs. Flávio; "+ Mais candidatos" adds up to two CPU rivals (Cury, Renan, Caiado) for 3–4 factions.

## Project layout

- `src/game/data.js` – states, regions, land borders, label positions
- `src/game/engine.js` – pure game rules (state in → new state out)
- `src/game/ai.js` – the CPU opponent, one visible action per step
- `src/game/texts.js` – UI copy and dialogue engine; candidate lines live in `src/game/lines/` (see its README)
- `src/game/simulation.js` – AI-vs-AI spectator mode
- `src/components/` – React UI (start screen, map, game screen, caricatures)

## Credits

Map shapes from [svg-maps](https://github.com/VictorCazanave/svg-maps) by Victor Cazanave,
licensed CC BY 4.0. Caricatures are original inline SVG drawings.

# WARZIL — dialogue files

One file per candidate (`lula.js`, `flavio.js`, `cury.js`, `renan.js`, `caiado.js`) plus neutral
headlines in `news.js`. Edit the text freely; the tests check structure and balance.

## Editorial rules

- Satire of **public personas** only: speaking style, catchphrases, hobbies, home state, public career.
- No accusations, legal cases, health, private family, religion or real campaign slogans.
- Lines are **fictional**; never present them as real quotes.
- **Balance:** every candidate has the same number of lines in each category
  (`tests/dialogue.test.js` fails otherwise).

## Categories

| key | when it shows |
|---|---|
| `start` | first line of the match |
| `turn` | start of the candidate's turn |
| `conquer` | candidate takes a state |
| `conquerSpecial` | `{ stateId: [...] }`, used about half the time on that state |
| `lose` | candidate loses a state (campaign diary) |
| `bigLoss` | attacker loses 3 armies in one roll |
| `regionGained` / `regionLost` | a whole region changes hands |
| `eliminates` | candidate knocks a rival out of the match |
| `eliminated` | candidate's last words when knocked out |
| `victory` | candidate holds all 27 states |
| `knockout` | candidate knocks out the human player |
| `defeat` | end-screen line when this candidate loses |

## Placeholders

| token | example (Bahia / São Paulo) |
|---|---|
| `{state}` | Bahia / São Paulo |
| `{o_state}` / `{O_state}` | a Bahia / São Paulo — `O_` capitalises the article at the start of a sentence |
| `{de_state}` | da Bahia / de São Paulo |
| `{em_state}` | na Bahia / em São Paulo |
| `{region}` | Nordeste (write "o {region}": all region names are masculine) |
| `{rival}` | another candidate's name (write "o {rival}") |

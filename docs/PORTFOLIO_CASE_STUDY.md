# WARZIL — Engineering case study

**Live product:** https://warzil.com.br  
**Category:** Browser-based strategy game with solo, local, and online multiplayer.

## The problem
Build an approachable territory strategy game with consistent game rules across local, AI, and real-time multiplayer play.

## Solution and architecture
- **Frontend:** React and Vite; map-based game interactions.
- **Rules engine:** Reusable game actions and turn resolution shared between modes.
- **Online backend:** Cloudflare Worker with Durable Objects for per-room authoritative state, dice resolution, and action validation.
- **Resilience:** Separate preview deployment, room expiry policies, and automated gameplay simulations.

## Technical decisions to discuss in an interview
1. Why the online server, not the browser, decides the outcome of a game action.
2. How the common rules engine reduces divergence between single-player and online matches.
3. How to test turn sequencing, invalid moves, AI behavior, and reconnections.
4. What changes would be required to scale rooms, observability, and abuse protection.

## Verification available in the repository
- `npm test` for game rules and AI simulations.
- `npm run build` for the frontend bundle.
- Browser-driven e2e scripts under `scripts/` (require additional setup; not included in the basic CI job).
- `.github/workflows/ci.yml` for automated checks; inspect Actions for actual status.

## Publication checklist — complete BEFORE making the repository public
- [ ] Inspect **all Git history**, not only the latest tree, for credentials, tokens, private keys, personal data, and deployment details.
- [ ] Verify analytics configuration and permissions; public client identifiers are not necessarily secrets, but should be intentional.
- [ ] Review tracked Pix assets and any recipient information for permission to publish.
- [ ] Review third-party artwork, fonts, source licenses, and attribution.
- [ ] Run tests/build and check the new CI status.
- [ ] Review public-facing satirical content and legal/product claims.
- [ ] Enable public visibility only after the items above are complete.

**Status:** Repository kept private while publication safety is assessed. No claim is made that these checks have all passed.

# AI Director 2.0 — bounded multi-turn story arcs

## What this changes

The Director now creates a short, *invisible* four-turn dramatic arc: the
current selected card opens a thread, then three **future** selection goals
(build → twist → payoff) are stored with the party.

This is narrative selection planning — not automatic generation of explicit
Truth/Dare text or guaranteed future events.

- The Worker produces exactly three structured future metadata beats:
  `{phase, chain, preferredType}`.
- The app validates them against the **existing eligible shortlist** and the
  current scene; unsupported themes or unsafe transitions are discarded.
- Each next turn, both remote AI and the deterministic fallback favor that
  beat's theme and type when they are **actually eligible**.
- After the third beat, the plan expires. A skipped card cancels it immediately.
- A Boss cannot interrupt a planned build/twist/payoff sequence.
- The entire plan is saved in the existing local game state; save/resume
  requires no new prompt, account, permission or screen.

## Boundaries and truthful AI

Future risk is chosen independently by the player. Plan metadata **cannot**
force a future card, override stage/clothing/partner restrictions, add a new
sexual practice, or infer whether someone enjoyed a real-world activity.
When a suitable theme is not available for the next player/risk/stage, the
normal Director chooses another valid card. No deadlocks.

In an established physical Sex scene, the client rejects future plan beats
that switch to a different intimate activity family. The plan only suggests
continuing the existing approved theme. Any new sexual action still requires
consent in the moment.

No player names, spoken answers, camera/microphone data, raw card text or
arbitrary user prose are added to the backend payload. All stored scene
metadata is validated again before being sent to the Worker.

## Backend compatibility

The existing `/game/director` endpoint retains `version: 1` and adds
`scenePlan` to its output plus optional `activeScene` on input. Older
clients continue working. Older responses without `scenePlan` still allow
safe card selection and the previous pacing fallback.

Tests: `npm run test:director`, `npm run test:e2e`, Worker `npm test` and
the Worker live smoke that checks a real three-beat AI-generated plan.

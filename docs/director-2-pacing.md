# Без Фильтров — AI Director 2.0: pacing foundation

This is the first production slice of Director 2.0, **not** AI Chains or generative Boss scenes.

## Contract

- No in-game surveys, likes, ratings, post-action forms, microphones, or emotional inference.
- The Director sees only game metadata already available locally: mode, stage, the player's selected risk, completed/skipped turns, card type, chain tags, anonymous actor/target indices, and accepted/rejected AI events.
- Risk stays exactly what the player chose. The hidden stage cannot be advanced by risk selection alone. Sexual boundaries and clothing gates remain authoritative.
- Skips are neutral. They pause momentum and avoid immediate repetition of the skipped theme; they do not lower a player's standing, imply dislike, or trigger punishment.
- AI responses select only prevalidated card IDs. With no usable AI response, the **same pacing planner** steers local card selection.
- The optional AI modifier is suppressed for recovery and an established intimate physical scene, so the game does not add pointless extra interruptions.

## Pacing intents

| Intent | Trigger | Effect |
|---|---|---|
| explore | No dominant signal | Explore fresh chain families in the existing risk/stage |
| develop | A developing chain, or ongoing physical scene in Sex | Prefer logical continuation |
| pivot | Three near-identical group turns | Prefer different type/topic |
| recover | The previous card was skipped | Change the topic, no optional modifier, no unsolicited AI event |
| breather | Two consecutive completed three-fire rounds | Prefer a contrasting Truth at the **same risk** |

The planner's inputs are semantic game facts, **not** a measure of enjoyment or real-world arousal.

## Target fairness

Eligible target indices are first selected by existing gender/pairing rules.
Among those valid indices, target counts over up to 16 *completed* recent turns
determine who has been involved least, with the oldest participation taking precedence.
No preferences or boundaries are bypassed.

## Progression & climax

- Progressing a stage requires completed turns, not a fabricated turn/tension counter.
- In Sex, low-risk completions alone cannot advance the hidden stage; accepted medium/high risk plus the existing boundaries/clothing restrictions are required.
- Boss needs a developed chain **and** at least three completed turns in its last four; group modes additionally require more than one actor.

## What is NOT yet implemented

Long-form branching multi-turn AI Chains, individualized AI-generated Boss scenes,
audio/voice mode, interpreted real-world reactions, and dynamically generated base
Truth/Dare cards. Those are distinct future milestones, not quietly shipped here.

## Tests

Run `npm run test:director`, `npm run test:e2e`, and the live production smoke.
Pacing regressions live in `scripts/test-v09-pacing.ts`.

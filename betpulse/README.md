# BetPulse V0

Personal, static iPhone/Safari NFL slip tracker for September 27–28, 2026.

## Run and verify

Serve this directory with any static HTTP server. No build step or dependencies.

```sh
node --test betpulse/tests/markets.test.cjs
```

Opening or returning to the page never calls ESPN. Tap either Refresh button.
Bundled, dated pregame context renders immediately; later successful snapshots
are retained in localStorage. Storage failures do not prevent rendering.

## Data and reliability

- Scoreboard requests use **one date per request**. ESPN returned HTTP 400 for
  the previous date-range query. Sunday and Monday failures are isolated.
- Completed 2026 regular-season weekly scoreboards supply team PPG/margins.
- Athlete `/stats` includes career rows despite the `season` query. Only 2026
  category rows are mapped via `names` and `stats`; career totals are ignored.
- `bootstrap.js` contains 15 verified games, 24 roster-verified athlete IDs,
  team averages and available season averages fetched before kickoff Sept 27.
  Jalen McMillan has no 2026 row in that response: unavailable, never fabricated.
- Bounded direct requests retry transient failures once, then use a bounded
  AllOrigins relay fallback. HTTP 4xx (except 429) does not retry via a relay.
  Relay failure opens a circuit for the page session. Live requests have no
  artificial cache-busting parameters. Four workers bound summary/stat traffic.
- Each completed schedule/summary/athlete request repaints independently.
  Missing feeds never erase slips or turn missing stats into final losses.
  Saved summaries carry a visible timestamp. Season context is cached six hours.
- No service worker: avoids stale application-code caches for this V0.
  Versioned JS/CSS and PNG Apple touch icons support Home Screen use.

## Market semantics

34 legs: Bet 1 (8), Bet 2 (10), Bet 3 (16). Original requirements and payouts
are in `slips.js`; no odds, wagers or transactions are sent to a sportsbook.

| Market | Source and handling |
| --- | --- |
| Totals | Both scores; under only hits at final, over can clear live |
| Moneyline | Final winner; tied final needs sportsbook settlement |
| Spread | Signed final margin; integer equality is PUSH |
| Receptions / receiving, passing, rushing yards / thrown INT | Exact boxscore category and label; integer plus vs strict decimal over |
| Anytime / 2+ TD | Scored rushing/receiving/return TD; never passing TD |
| Rush + receiving yards | Sum both categories, including negative rushing yards |
| Longest rush | Rushing LONG/LNG only; never receiving LONG |
| Fourth-quarter rushing | Deduplicated previous/current drive plays, period 4 only; no-play exclusions; runner-name matching, not tackler matching |
| Sack yes | Defensive SACK/SACKS; half sacks count |
| D/ST TD | Matching scoring team and a qualifying return/recovery touchdown; no two-point return |

Half-sack rule: https://www.fanduel.com/fanduel-sportsbook-house-rules-nj
(section “Player to Record a Sack”: half sacks count as Yes).

Specialty context is labeled: full-game rushing yards for Q4/longest rush;
team scoring/allowed PPG for D/ST, **not** a D/ST touchdown rate.

PENDING deliberately extends HIT/LIVE/LOST/UPCOMING when a feed is unavailable.
An absent player row is not evidence of participation, zero, or a sportsbook
loss. HIT/LOST reflect stats, not official settlement; voids, player participation
rules and stat corrections are not automatically adjudicated. Q4 play-by-play
can lag and unusual lateral/recovery touchdowns may need sportsbook review.

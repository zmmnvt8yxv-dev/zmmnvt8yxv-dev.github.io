/** Read-only Sleeper API adapter. No private tokens or league IDs stored in source. */
const API = "https://api.sleeper.app/v1";
const errorMessage = err => err instanceof Error ? err.message : String(err);

async function sleeperJson(path, signal) {
  const response = await fetch(API + path, { signal, cache: "no-store", headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error("Sleeper returned HTTP " + response.status + " for " + path);
  return response.json();
}

async function loadSeason(league, { signal, onProgress, prior = false }) {
  const leagueId = String(league.league_id);
  const [users, rosters] = await Promise.all([
    sleeperJson("/league/" + leagueId + "/users", signal),
    sleeperJson("/league/" + leagueId + "/rosters", signal)
  ]);
  if (!Array.isArray(users) || !Array.isArray(rosters)) throw new Error("Sleeper's league membership response was invalid.");
  const finalWeek = prior ? 18 : Math.max(1, Math.min(18, Number(league.leg) || Number(league.settings?.last_scored_leg) || 1));
  const weeks = Array.from({ length: finalWeek + 1 }, (_, index) => index);
  const transactions = [];
  const failedWeeks = [];
  // Keep API usage modest; support incomplete partial responses visibly.
  for (let start = 0; start < weeks.length; start += 4) {
    const batch = weeks.slice(start, start + 4);
    const results = await Promise.allSettled(batch.map(week =>
      sleeperJson("/league/" + leagueId + "/transactions/" + week, signal)
    ));
    for (let i = 0; i < batch.length; i++) {
      if (results[i].status === "fulfilled" && Array.isArray(results[i].value)) {
        transactions.push(...results[i].value);
      } else {
        failedWeeks.push(batch[i]);
      }
    }
    onProgress?.("Reading " + league.season + " waivers · " + Math.min(start + 4, weeks.length) + "/" + weeks.length + " weeks");
    if (signal?.aborted) throw new DOMException("Cancelled", "AbortError");
  }
  if (failedWeeks.length === weeks.length) throw new Error("No Sleeper transaction weeks could be loaded for " + league.season);
  return { league, users, rosters, transactions, failedWeeks, queriedWeeks: weeks.length };
}

let playerDirectoryPromise = null;
async function loadPlayers(signal) {
  // Memoized per browser runtime so the large player directory is not repeatedly fetched.
  if (!playerDirectoryPromise) {
    playerDirectoryPromise = sleeperJson("/players/nfl?active=true", signal).catch(error => {
      playerDirectoryPromise = null;
      throw error;
    });
  }
  return playerDirectoryPromise;
}

/**
 * Loads this year's claims and optionally the immediately preceding Sleeper year.
 * All fetched transactions remain in browser memory; no server/database write.
 */
export async function loadWaiverHistory({ leagueId, includePrevious = true, signal, onProgress } = {}) {
  const id = String(leagueId || "").trim();
  if (!/^\d{8,25}$/.test(id)) throw new Error("Enter a valid numeric Sleeper league ID.");
  onProgress?.("Connecting to Sleeper…");
  const currentLeague = await sleeperJson("/league/" + id, signal);
  if (!currentLeague?.league_id || currentLeague.sport !== "nfl") {
    throw new Error("This is not an accessible NFL Sleeper league.");
  }
  const seasons = [];
  const warningMessages = [];
  const latest = await loadSeason(currentLeague, { signal, onProgress });
  seasons.push(latest);
  if (latest.failedWeeks.length) warningMessages.push("Missing " + latest.failedWeeks.length + " week(s) of " + currentLeague.season + " transactions.");
  if (includePrevious && /^\d{8,25}$/.test(String(currentLeague.previous_league_id || ""))) {
    try {
      const previous = await sleeperJson("/league/" + currentLeague.previous_league_id, signal);
      if (Number(previous.season) === Number(currentLeague.season) - 1) {
        const earlier = await loadSeason(previous, { signal, onProgress, prior: true });
        seasons.push(earlier);
        if (earlier.failedWeeks.length) warningMessages.push("Missing " + earlier.failedWeeks.length + " week(s) of " + previous.season + " transactions.");
      } else {
        warningMessages.push("Prior league was not the immediately preceding season, so it was excluded.");
      }
    } catch (error) {
      if (signal?.aborted) throw error;
      warningMessages.push("Previous-season data unavailable: " + errorMessage(error));
    }
  }
  onProgress?.("Classifying waiver bids…");
  let players = {};
  try {
    players = await loadPlayers(signal);
    if (!players || typeof players !== "object") throw new Error("Unexpected player directory");
  } catch (error) {
    if (signal?.aborted) throw error;
    warningMessages.push("Player positions unavailable; forecasts will use league-wide bidding history.");
  }
  return {
    seasons,
    players,
    warnings: warningMessages,
    updatedAt: new Date().toISOString(),
    activeSeason: Number(currentLeague.season),
    activeWeek: Number(currentLeague.leg) || Number(currentLeague.settings?.last_scored_leg) || 1
  };
}

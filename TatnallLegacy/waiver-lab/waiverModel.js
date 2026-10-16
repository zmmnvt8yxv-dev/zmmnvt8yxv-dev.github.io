/**
 * Waiver Lab: explainable conditional FAAB forecasts.
 *
 * Scope: public, already-processed Sleeper waiver transactions only.
 * A forecast is conditional on the selected number of rivals pursuing the
 * same target. Pending claims, intended targets and future player values
 * are not observable through the public API.
 */
const STATUSES = new Set(["complete", "failed"]);
const POSITIONS = new Set(["QB", "RB", "WR", "TE", "K", "DEF"]);

const weightedAverage = (rows, value) => {
  const sum = rows.reduce((total, row) => total + row.weight, 0);
  return sum ? rows.reduce((total, row) => total + value(row) * row.weight, 0) / sum : null;
};
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const round = value => Math.round(value * 100) / 100;

function playerPosition(players, id) {
  const player = players?.[id];
  const value = String(player?.position || player?.fantasy_positions?.[0] || "").toUpperCase();
  return POSITIONS.has(value) ? value : null;
}

/** Each transaction ID contributes at most one original claim to the model. */
export function normalizeWaiverClaims(snapshots, players = {}) {
  const seen = new Set();
  const claims = [];
  for (const snapshot of snapshots || []) {
    const leagueId = String(snapshot.league?.league_id || "");
    const season = Number(snapshot.league?.season);
    const rosterOwners = new Map((snapshot.rosters || []).map(roster => [
      String(roster.roster_id), String(roster.owner_id || "")
    ]));
    for (const tx of snapshot.transactions || []) {
      if (tx?.type !== "waiver" || !STATUSES.has(tx.status)) continue;
      if (tx.settings?.waiver_bid == null) continue;
      const bid = Number(tx.settings.waiver_bid);
      const transactionId = String(tx.transaction_id || "");
      const rosterId = String(tx.roster_ids?.[0] ?? "");
      const userId = rosterOwners.get(rosterId);
      if (!transactionId || !userId || !Number.isFinite(bid) || bid < 0 || !Number.isInteger(bid)) continue;
      const identity = leagueId + "/" + transactionId;
      if (seen.has(identity)) continue;
      seen.add(identity);
      const playerId = Object.keys(tx.adds || {})[0] || null;
      // "Failed" includes lost bidding and other waiver-processing failures;
      // do not label all failures as outbid.
      claims.push({
        transactionId, leagueId, userId, rosterId, season,
        week: Number(tx.leg ?? tx.week ?? snapshot.week ?? 0),
        bid, status: tx.status,
        reason: tx.metadata?.notes || null,
        playerId, position: playerId ? playerPosition(players, playerId) : null
      });
    }
  }
  return claims.sort((a, b) => a.season - b.season || a.week - b.week || a.transactionId.localeCompare(b.transactionId));
}

export function managerProfiles(snapshots, claims) {
  const current = snapshots?.[0];
  if (!current) return [];
  const usernames = new Map((current.users || []).map(user =>
    [String(user.user_id), user.metadata?.team_name || user.display_name || user.username || "Unknown manager"]
  ));
  const season = Number(current.league?.season);
  const totalBudget = Number(current.league?.settings?.waiver_budget);
  return (current.rosters || []).filter(roster => roster.owner_id).map(roster => {
    const userId = String(roster.owner_id);
    const own = claims.filter(c => c.userId === userId);
    const thisSeason = own.filter(c => c.season === season);
    const positive = own.filter(c => c.bid > 0);
    const currentPositive = thisSeason.filter(c => c.bid > 0);
    const used = Number(roster.settings?.waiver_budget_used);
    const balanceKnown = Number.isFinite(totalBudget) && totalBudget >= 0 && Number.isFinite(used) && used >= 0;
    const balance = balanceKnown ? clamp(totalBudget - used, 0, totalBudget) : null;
    const numbers = positive.map(c => c.bid).sort((a, b) => a - b);
    const medianPositive = numbers.length ? round((numbers[Math.floor((numbers.length - 1) / 2)] + numbers[Math.floor(numbers.length / 2)]) / 2) : null;
    return {
      userId,
      rosterId: String(roster.roster_id),
      name: usernames.get(userId) || "Roster " + roster.roster_id,
      balance,
      balanceKnown,
      totalBudget: Number.isFinite(totalBudget) ? totalBudget : null,
      claims: own.length,
      currentClaims: thisSeason.length,
      wins: own.filter(c => c.status === "complete").length,
      losses: own.filter(c => c.status === "failed").length,
      currentWins: thisSeason.filter(c => c.status === "complete").length,
      zeroBids: own.filter(c => c.bid === 0).length,
      paidClaims: positive.length,
      currentPaidClaims: currentPositive.length,
      medianPositive,
      maxBid: numbers.length ? numbers[numbers.length - 1] : null,
      biggestFailedBid: own.filter(c => c.status === "failed").reduce((n, c) => Math.max(n, c.bid), 0),
      avgBid: own.length ? round(own.reduce((n, c) => n + c.bid, 0) / own.length) : null
    };
  }).sort((a, b) => (b.currentClaims - a.currentClaims) || a.name.localeCompare(b.name));
}

function recencyWeight(claim, currentSeason, currentWeek) {
  const weeksOld = Math.max(0, (currentSeason - claim.season) * 18 + currentWeek - claim.week);
  return Math.pow(0.97, weeksOld);
}

function sampleFor(rows, currentSeason, currentWeek) {
  return rows.map(c => ({ bid: c.bid, weight: recencyWeight(c, currentSeason, currentWeek) }));
}

/**
 * Empirical Bayes style shrinkage: use a manager's history when substantial,
 * otherwise lean on the league's position pool, or all bids as the fallback.
 */
function rivalDistribution(claims, userId, position, season, week) {
  const own = claims.filter(c => c.userId === userId);
  const ownPosition = own.filter(c => c.position === position);
  const poolPosition = claims.filter(c => c.position === position);
  const personal = ownPosition.length >= 3 ? ownPosition : own;
  const pooled = poolPosition.length >= 8 ? poolPosition : claims;
  const managerWeight = personal.length / (personal.length + 6);
  return { personal: sampleFor(personal, season, week), pooled: sampleFor(pooled, season, week), managerWeight, ownCount: own.length, positionCount: ownPosition.length };
}

function effectiveOpponentBid(rawBid, profile, urgencyFactor) {
  // An opponent cannot offer more than its remaining known FAAB budget.
  const desired = Math.round(rawBid * urgencyFactor);
  return profile.balance == null ? desired : Math.min(profile.balance, desired);
}

function lessThanProbability(samples, bid, profile, urgencyFactor) {
  return weightedAverage(samples, row => effectiveOpponentBid(row.bid, profile, urgencyFactor) < bid ? 1 : 0);
}

export function forecastWaiver({
  claims = [], profiles = [], ownUserId, position = "RB",
  urgency = "normal", competingManagers = 2, season, week
}) {
  const own = profiles.find(p => p.userId === String(ownUserId));
  if (!own) return { available: false, reason: "Choose your roster to estimate an affordable bid." };
  if (!claims.length) return { available: false, reason: "No processed waiver claims are available yet." };
  const currentSeason = Number(season) || Math.max(...claims.map(c => c.season));
  const currentWeek = Number(week) || 1;
  const multipliers = { cautious: 0.75, normal: 1, aggressive: 1.5 };
  const factor = multipliers[urgency] ?? 1;
  const opponents = profiles.filter(p => p.userId !== own.userId).map(profile => {
    const distribution = rivalDistribution(claims, profile.userId, position, currentSeason, currentWeek);
    const expectation = weightedAverage(distribution.personal, row => effectiveOpponentBid(row.bid, profile, factor));
    const poolExpectation = weightedAverage(distribution.pooled, row => effectiveOpponentBid(row.bid, profile, factor));
    return {
      profile,
      distribution,
      threat: distribution.managerWeight * (expectation ?? 0) + (1 - distribution.managerWeight) * (poolExpectation ?? 0)
    };
  }).sort((a, b) => b.threat - a.threat || a.profile.name.localeCompare(b.profile.name));
  const selection = opponents.slice(0, clamp(Math.round(Number(competingManagers) || 1), 1, opponents.length));
  if (!selection.length) return { available: false, reason: "No competing rosters were found." };
  const totalPositionSamples = claims.filter(c => c.position === position).length;
  const maxBudget = own.balance == null ? own.totalBudget : own.balance;
  const maxBid = Number.isFinite(maxBudget) ? Math.max(0, Math.floor(maxBudget)) : 100;
  const chanceAt = bid => {
    if (!Number.isFinite(bid) || bid < 0) return null;
    return selection.reduce((probability, item) => {
      const { personal, pooled, managerWeight } = item.distribution;
      const managerProbability = lessThanProbability(personal, bid, item.profile, factor);
      const fallbackProbability = lessThanProbability(pooled, bid, item.profile, factor);
      const probabilityAgainstRival = managerWeight * (managerProbability ?? fallbackProbability ?? 0) +
        (1 - managerWeight) * (fallbackProbability ?? managerProbability ?? 0);
      return probability * probabilityAgainstRival;
    }, 1);
  };
  const curve = Array.from({ length: maxBid + 1 }, (_, bid) => ({ bid, probability: chanceAt(bid) }));
  const bidAt = target => curve.find(point => point.probability >= target)?.bid ?? null;
  return {
    available: true, own, opponents: selection.map(item => ({
      userId: item.profile.userId, name: item.profile.name,
      samples: item.distribution.ownCount, knownPositionClaims: item.distribution.positionCount,
      balance: item.profile.balance
    })),
    requestedPosition: position,
    positionSampleCount: totalPositionSamples,
    pooledSampleCount: claims.length,
    fallbackUsed: totalPositionSamples < 8,
    competitorsAssumed: selection.length,
    zeroDollar: chanceAt(0),
    bids: { half: bidAt(0.5), strong: bidAt(0.75), safer: bidAt(0.9) },
    curve, probabilityAt: chanceAt,
    confidence: claims.length < 20 || totalPositionSamples < 8 ? "limited" :
      selection.some(item => item.distribution.ownCount < 5) ? "moderate" : "informative",
    method: "Conservative empirical estimate; ties counted as losses; assumes the selected rivals submit claims for the same player."
  };
}

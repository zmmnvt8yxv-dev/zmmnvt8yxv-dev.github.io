import { loadWaiverHistory } from "./waiverApi.js";
import { forecastWaiver, managerProfiles, normalizeWaiverClaims } from "./waiverModel.js";

const $ = id => document.getElementById(id);
const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, char => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
})[char]);
const dollar = value => value == null || !Number.isFinite(Number(value)) ? "—" : "$" + Number(value).toLocaleString("en-US", { maximumFractionDigits: 2 });
const pct = number => number == null || !Number.isFinite(number) ? "—" : Math.round(number * 100) + "%";
let snapshot = null, claims = [], profiles = [], controller = null;
let ownUserId = "", position = "RB", urgency = "normal", competingManagers = 2, playerName = "", testedBid = 10;

function setStatus(text, kind = "") {
  $("load-status").textContent = text;
  $("load-status").className = "status " + kind;
}
function warning(text) {
  const node = document.createElement("p");
  node.className = "warning";
  node.textContent = text;
  $("warnings").append(node);
}
async function load(event) {
  event?.preventDefault();
  controller?.abort();
  controller = new AbortController();
  const signal = controller.signal;
  const id = $("league-id").value.trim();
  if (!/^\d{8,25}$/.test(id)) return setStatus("Enter a numeric Sleeper league ID (8–25 digits).", "error");
  $("load").disabled = true;
  $("results").hidden = true;
  $("warnings").replaceChildren();
  setStatus("Connecting to Sleeper…");
  try {
    const result = await loadWaiverHistory({
      leagueId: id, includePrevious: $("include-previous").checked, signal,
      onProgress: message => { if (!signal.aborted) setStatus(message); }
    });
    if (signal.aborted) return;
    snapshot = result;
    claims = normalizeWaiverClaims(result.seasons, result.players);
    profiles = managerProfiles(result.seasons, claims);
    ownUserId = "";
    for (const msg of result.warnings) warning(msg);
    if (!claims.length) warning("No qualifying processed waiver claims were found in the retrieved weeks. Private pending bids cannot be inspected.");
    const params = new URLSearchParams(location.search);
    params.set("league", id);
    history.replaceState(history.state, "", location.pathname + "?" + params.toString());
    setStatus("Loaded " + claims.length + " processed claims from " + result.seasons.map(s => s.league.season).join(" + ") + ". Last checked " + new Date(result.updatedAt).toLocaleTimeString() + ".", "success");
    $("results").hidden = false;
    renderControls();
    renderManagers();
    renderForecast();
  } catch (error) {
    if (signal.aborted) return;
    setStatus(error instanceof Error ? error.message : String(error), "error");
  } finally {
    if (!signal.aborted) $("load").disabled = false;
  }
}

function renderControls() {
  $("your-team").innerHTML = '<option value="">Choose your roster</option>' + profiles.map(p =>
    '<option value="' + escapeHtml(p.userId) + '">' + escapeHtml(p.name) + "</option>"
  ).join("");
  $("your-team").value = ownUserId;
  $("rivals").innerHTML = Array.from({ length: Math.max(1, profiles.length - 1) }, (_, i) => {
    const n = i + 1;
    return '<option value="' + n + '"' + (n === competingManagers ? " selected" : "") + ">" + n + " competing " + (n === 1 ? "manager" : "managers") + "</option>";
  }).join("");
  $("position").value = position;
  $("urgency").value = urgency;
  $("target-name").value = playerName;
}
function renderManagers() {
  const season = snapshot.activeSeason;
  $("owner-count").textContent = profiles.length + " current franchises";
  $("manager-table").innerHTML = '<div class="table-wrap"><table class="table"><thead><tr><th scope="col">Manager</th><th scope="col">FAAB left</th><th scope="col">' + season + ' claims</th><th scope="col">Paid bids</th><th scope="col">Median paid</th><th scope="col">Largest</th><th scope="col">Failed claims</th></tr></thead><tbody>' +
    profiles.map(p => '<tr><th scope="row">' + escapeHtml(p.name) + '</th><td>' + dollar(p.balance) + '</td><td>' + p.currentClaims + '</td><td>' + p.paidClaims + '</td><td>' + dollar(p.medianPositive) + '</td><td>' + dollar(p.maxBid) + '</td><td>' + p.losses + "</td></tr>").join("") +
    '</tbody></table></div><p class="subtle">Claims are attempts, not distinct waiver periods. Only the claims column is current-season-only; spending history includes the preceding season when selected.</p>';
  $("manager-detail").innerHTML = profiles.map(p => {
    const history = claims.filter(c => c.userId === p.userId).sort((a, b) => b.season - a.season || b.week - a.week);
    return '<details class="evidence"><summary>' + escapeHtml(p.name) + '<small>' + history.length + ' claims · ' + p.wins + ' completed · ' + p.losses + ' failed</small></summary><div class="table-wrap"><table class="table"><thead><tr><th>Season / week</th><th>Position</th><th>Bid</th><th>Status</th><th>Processing note</th></tr></thead><tbody>' +
      (history.length ? history.map(c => '<tr><td>' + c.season + ' · W' + c.week + '</td><td>' + escapeHtml(c.position || "Unknown") + '</td><td>' + dollar(c.bid) + '</td><td><span class="badge ' + (c.status === "complete" ? "good" : "bad") + '">' + escapeHtml(c.status) + '</span></td><td>' + escapeHtml(c.reason || "No note") + '</td></tr>').join("") : '<tr><td colspan="5">No processed claims found for this manager.</td></tr>') +
      "</tbody></table></div></details>";
  }).join("");
}
function plot(curve) {
  const maxBid = Math.max(1, curve.at(-1)?.bid || 0);
  const x = bid => 44 + bid / maxBid * 660;
  const y = probability => 163 - probability * 139;
  const stride = Math.max(1, Math.ceil(curve.length / 150));
  const points = curve.filter((_, i) => i % stride === 0 || i === curve.length - 1).map(c => x(c.bid).toFixed(1) + "," + y(c.probability).toFixed(1)).join(" ");
  return '<div class="plot" role="img" aria-label="How the estimated chance of outbidding these opponents changes with your bid"><svg viewBox="0 0 750 195" xmlns="http://www.w3.org/2000/svg">' +
    [0, .25, .5, .75, 1].map(v => '<line x1="44" x2="704" y1="' + y(v) + '" y2="' + y(v) + '"/><text x="36" y="' + (y(v) + 4) + '" text-anchor="end">' + Math.round(100 * v) + '%</text>').join("") +
    '<polyline points="' + points + '"/>' + [0, .25, .5, .75, 1].map(v => '<text x="' + x(v * maxBid) + '" y="187" text-anchor="middle">' + dollar(Math.round(v * maxBid)) + '</text>').join("") + '</svg></div>';
}
function renderForecast() {
  const node = $("forecast");
  if (!ownUserId) {
    node.innerHTML = '<p class="placeholder">Choose your franchise to start analyzing your bid against the other managers.</p>';
    return;
  }
  const result = forecastWaiver({
    claims, profiles, ownUserId, position, urgency, competingManagers,
    season: snapshot.activeSeason, week: snapshot.activeWeek
  });
  if (!result.available) {
    node.innerHTML = '<p class="placeholder">' + escapeHtml(result.reason) + '</p>';
    return;
  }
  const budget = result.own.balance ?? result.own.totalBudget ?? 100;
  const cap = Math.max(0, Math.floor(budget));
  testedBid = Math.min(Math.max(0, Number(testedBid) || 0), cap);
  const cards = [
    ["50% conditional", result.bids.half, "Moderate threshold"],
    ["75% conditional", result.bids.strong, "Stronger threshold"],
    ["90% conditional", result.bids.safer, "Conservative threshold"]
  ];
  node.innerHTML = '<div class="cards">' + cards.map(([title, bid, hint], index) =>
    '<div class="card' + (index === 1 ? " featured" : "") + '"><span>' + title + '</span><strong>' + (bid == null ? "Out of reach" : dollar(bid)) + '</strong><small>' + hint + ' · max available ' + dollar(cap) + '</small></div>').join("") +
    '</div><div class="sim-grid"><div class="sim-box"><h3>' + escapeHtml(playerName || position + " pickup") + ' · test your bid</h3>' +
    '<div class="bid-head"><strong id="bid-value">' + dollar(testedBid) + '</strong><span id="bid-odds">' + pct(result.probabilityAt(testedBid)) + ' conditional chance</span></div>' +
    '<label class="field" for="bid-slider">Try a FAAB amount</label><input type="range" id="bid-slider" min="0" max="' + cap + '" step="1" value="' + testedBid + '">' +
    '<div class="endpoints"><span>$0</span><span>Your FAAB: ' + dollar(result.own.balance) + '</span></div>' + plot(result.curve) +
    '</div><aside class="rivals-box"><h3>Modeled opponents</h3><p>Assumes every listed opponent submits a claim for the same player. These are the highest estimated spenders in the chosen scenario.</p><ol>' +
    result.opponents.map(op => '<li>' + escapeHtml(op.name) + '<small>' + op.samples + ' observed claims · ' + dollar(op.balance) + ' FAAB left</small></li>').join("") +
    '</ol><p>Evidence: <strong>' + escapeHtml(result.confidence) + '</strong><br>' + result.positionSampleCount + ' known ' + escapeHtml(position) + ' claims out of ' + result.pooledSampleCount + ' overall</p></aside></div>' +
    '<p class="fineprint">Scenario estimates are not calibrated real-world probabilities. They combine observed completed and failed claims, recency-weighted manager histories, and a league-wide fallback. Tied bids count as losses. Opponent bidding decisions can be correlated. ' +
    (result.fallbackUsed ? 'Position evidence is too sparse to rely on, so the league-wide distribution is used.' : 'Position-specific bidding history informs this scenario.') + '</p>';
  $("bid-slider").addEventListener("input", event => {
    testedBid = Number(event.target.value);
    $("bid-value").textContent = dollar(testedBid);
    $("bid-odds").textContent = pct(result.probabilityAt(testedBid)) + " conditional chance";
  });
}
$("source-form").addEventListener("submit", load);
$("your-team").addEventListener("change", e => { ownUserId = e.target.value; renderForecast(); });
$("position").addEventListener("change", e => { position = e.target.value; renderForecast(); });
$("urgency").addEventListener("change", e => { urgency = e.target.value; renderForecast(); });
$("rivals").addEventListener("change", e => { competingManagers = Number(e.target.value); renderForecast(); });
$("target-name").addEventListener("input", e => {
  playerName = e.target.value;
  const heading = $("forecast").querySelector(".sim-box h3");
  if (heading) heading.textContent = (playerName || position + " pickup") + " · test your bid";
});
const leagueFromLink = new URLSearchParams(location.search).get("league") || "";
if (/^\d{8,25}$/.test(leagueFromLink)) {
  $("league-id").value = leagueFromLink;
  load();
}

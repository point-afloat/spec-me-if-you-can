// Leaderboard pane, live stream with polling fallback, bingo toasts and the unicorn.
// All text is written with textContent, never as markup: nicknames come from other players.

const list = document.getElementById("board-list");
const foot = document.getElementById("board-foot");
const toasts = document.getElementById("toasts");
const unicorn = document.getElementById("unicorn");

const STALL_MS = 25000; // the server sends a snapshot every 10 s, so silence means a stalled stream
const POLL_MS = 3000;
const TOAST_MS = 6000;
const MAX_TOASTS = 3;
const DANCE_MS = 6000;
const MAX_SCORE = 24;

let you = null;
let source = null;
let lastMessage = Date.now();
let pollTimer = null;
let started = false;

// ---------- standings pane ----------
function makeRow(row, own) {
  const li = document.createElement("li");
  li.className = "row";
  if (own) {
    li.classList.add("own");
    li.setAttribute("aria-current", "true");
  }
  const rank = document.createElement("span");
  rank.className = "rank";
  rank.textContent = `#${row.rank}`;

  const who = document.createElement("span");
  who.className = "who";
  const name = document.createElement("span");
  name.className = "name";
  name.textContent = row.name;
  who.append(name);
  if (row.badge) {
    li.classList.add("agi-done");
    const caption = document.createElement("small");
    caption.className = "caption";
    caption.textContent = "AGI ACHIEVED";
    who.append(caption);
  }

  const bar = document.createElement("span");
  bar.className = "bar";
  bar.setAttribute("aria-hidden", "true");
  const fill = document.createElement("i");
  fill.style.width = `${Math.round((row.score / MAX_SCORE) * 100)}%`;
  bar.append(fill);

  const score = document.createElement("span");
  score.className = "score";
  score.textContent = `${row.score}x Engineer`;

  li.append(rank, who, bar, score);
  return li;
}

function renderStandings(snap) {
  you = snap.you;
  const items = snap.top.map((row) => makeRow(row, you !== null && row.id === you.id));
  if (you && !snap.top.some((row) => row.id === you.id)) {
    const gap = document.createElement("li");
    gap.className = "gap";
    gap.setAttribute("aria-hidden", "true");
    gap.textContent = "...";
    items.push(gap, makeRow(you, true));
  }
  list.replaceChildren(...items);
  foot.textContent = snap.total === 1 ? "1 player" : `${snap.total} players`;
}

// ---------- toasts and unicorn ----------
function toast(text) {
  const el = document.createElement("div");
  el.className = "toast mono";
  el.textContent = text;
  toasts.append(el);
  while (toasts.children.length > MAX_TOASTS) toasts.firstElementChild.remove();
  setTimeout(() => el.remove(), TOAST_MS);
}

let danceTimer = null;
function danceUnicorn() {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  // One unicorn at a time: a new bingo restarts the dance.
  unicorn.hidden = false;
  unicorn.classList.remove("dancing");
  void unicorn.offsetWidth; // restart the CSS animation
  unicorn.classList.add("dancing");
  clearTimeout(danceTimer);
  danceTimer = setTimeout(() => {
    unicorn.hidden = true;
    unicorn.classList.remove("dancing");
  }, DANCE_MS);
}

function onBingo(event) {
  const own = you !== null && event.id === you.id;
  toast(own ? `You got bingo - #${event.place}` : `${event.name} got bingo - #${event.place}`);
  danceUnicorn();
}

// ---------- live stream with polling fallback ----------
function heard() {
  lastMessage = Date.now();
  stopPolling();
}

function onStandings(event) {
  heard();
  renderStandings(JSON.parse(event.data));
}

function onBingoEvent(event) {
  heard();
  onBingo(JSON.parse(event.data));
}

async function pollOnce() {
  try {
    const response = await fetch("/api/standings", { credentials: "same-origin" });
    if (response.ok) renderStandings(await response.json());
  } catch {
    /* offline: try again on the next tick */
  }
}

function startPolling() {
  if (pollTimer) return;
  pollOnce();
  pollTimer = setInterval(pollOnce, POLL_MS);
}

function stopPolling() {
  clearInterval(pollTimer);
  pollTimer = null;
}

function connect() {
  if (source) source.close();
  lastMessage = Date.now();
  source = new EventSource("/api/events");
  source.addEventListener("standings", onStandings);
  source.addEventListener("bingo", onBingoEvent);
  source.onerror = () => {
    startPolling();
    // The browser retries by itself, except after an HTTP error (e.g. 503): then retry here.
    if (source.readyState === EventSource.CLOSED) setTimeout(connect, POLL_MS);
  };
}

function start() {
  // A new card (first visit, or the cookie was replaced) means a new viewer: reopen the stream.
  started = true;
  connect();
}

document.addEventListener("bingo:card", start);
setTimeout(() => {
  if (!started) start();
}, 3000);

setInterval(() => {
  if (started && Date.now() - lastMessage > STALL_MS) {
    startPolling();
    connect();
  }
}, 5000);

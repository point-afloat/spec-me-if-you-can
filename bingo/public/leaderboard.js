// Leaderboard pane, live updates (EventSource with a polling fallback) and bingo toasts.
// Everything that comes from other players is written with textContent, never as markup.

const list = document.getElementById("lb-list");
const total = document.getElementById("lb-total");
const toasts = document.getElementById("toasts");

const POLL_MS = 3000; // fallback polling interval while the stream is unavailable
const STALL_MS = 25000; // the server sends a snapshot at least every 10 s; silence this long = stalled
const RECONNECT_MS = 3000;
const TOAST_MS = 6000;
const MAX_TOASTS = 3;
const WORD_CELLS = 24;

let myId = null;
let source = null;
let pollTimer = null;
let lastMessageAt = Date.now();

// ------------------------------------------------------------------ rendering

function span(className, text) {
  const el = document.createElement("span");
  el.className = className;
  el.textContent = text;
  return el;
}

function row(entry, rank, isMe) {
  const li = document.createElement("li");
  if (isMe) li.classList.add("me");
  if (entry.badge) li.classList.add("win");
  const name = span("n", "");
  name.append(span("nm", entry.name));
  if (entry.badge) name.append(span("tag", "AGI ACHIEVED"));
  const bar = document.createElement("span");
  bar.className = "b";
  const fill = document.createElement("i");
  fill.style.width = `${Math.round((entry.score / WORD_CELLS) * 100)}%`;
  bar.append(fill);
  li.append(
    span("r", `#${rank}`),
    name,
    bar,
    span("s", `${entry.score}x Engineer`),
  );
  return li;
}

function render(snapshot) {
  myId = snapshot.you ? snapshot.you.id : null;
  const rows = snapshot.top.map((entry, i) => row(entry, i + 1, snapshot.you !== null && entry.id === snapshot.you.id));
  if (snapshot.you && snapshot.you.rank > snapshot.top.length) {
    const gap = document.createElement("li");
    gap.className = "gap";
    gap.textContent = "…";
    rows.push(gap, row(snapshot.you, snapshot.you.rank, true));
  }
  if (rows.length === 0) {
    const empty = document.createElement("li");
    empty.className = "gap";
    empty.textContent = "waiting for players_";
    rows.push(empty);
  }
  list.replaceChildren(...rows);
  total.textContent = `${snapshot.total} player${snapshot.total === 1 ? "" : "s"}`;
}

// ------------------------------------------------------------------ toasts

function toast(text) {
  const el = document.createElement("p");
  el.className = "toast mono";
  el.textContent = text;
  toasts.append(el);
  while (toasts.children.length > MAX_TOASTS) toasts.firstElementChild.remove();
  setTimeout(() => el.remove(), TOAST_MS);
}

function onBingo(event) {
  const { id, name, place } = JSON.parse(event.data);
  toast(id === myId ? `🚀 You got bingo! · #${place}` : `🚀 ${name} got bingo · #${place}`);
}

// ------------------------------------------------------------------ live stream with polling fallback

async function fetchStandings() {
  try {
    const response = await fetch("/api/standings", { credentials: "same-origin" });
    if (response.ok) render(await response.json());
  } catch {
    /* offline: the next poll tries again */
  }
}

function startPolling() {
  if (pollTimer) return;
  fetchStandings();
  pollTimer = setInterval(fetchStandings, POLL_MS);
}

function stopPolling() {
  clearInterval(pollTimer);
  pollTimer = null;
}

function onStreamMessage() {
  lastMessageAt = Date.now();
  stopPolling(); // the stream works again
}

function connect() {
  if (source) source.close();
  lastMessageAt = Date.now();
  source = new EventSource("/api/events");
  source.addEventListener("standings", (event) => {
    onStreamMessage();
    render(JSON.parse(event.data));
  });
  source.addEventListener("bingo", (event) => {
    onStreamMessage();
    onBingo(event);
  });
  source.onerror = () => {
    startPolling();
    // A refused or wrong response closes the EventSource for good; ask for a new one ourselves.
    if (source.readyState === EventSource.CLOSED) setTimeout(connect, RECONNECT_MS);
  };
}

// A silent stream (a proxy holding responses back, a dead mobile connection) is as bad as an error.
setInterval(() => {
  if (Date.now() - lastMessageAt > STALL_MS) {
    startPolling();
    connect();
  }
}, 5000);

// Phones drop connections while the tab is hidden: catch up as soon as it is visible again.
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) fetchStandings();
});

connect();

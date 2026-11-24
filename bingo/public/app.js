// All text is written with textContent / value, never as markup:
// nicknames come from other players and must always be shown as plain text.

const grid = document.getElementById("grid");
const banner = document.getElementById("bingo-banner");
const who = document.getElementById("who");
const errorBox = document.getElementById("error");
const form = document.getElementById("nickname-form");
const input = document.getElementById("nickname");
const hint = document.getElementById("nickname-hint");
const stats = document.getElementById("stats");
const agiBar = document.getElementById("agi-bar");
const agiMeter = document.querySelector(".agi");

function showError(message) {
  errorBox.textContent = message ?? "";
  errorBox.hidden = !message;
}

function makeCell(cell) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "cell";
  button.dataset.cell = String(cell.cell);
  button.style.animationDelay = `${cell.cell * 22}ms`;
  if (cell.free) {
    button.classList.add("free");
    button.textContent = "🍕";
    button.setAttribute("aria-label", "Free pizza");
    button.disabled = true;
  } else {
    button.addEventListener("click", () => mark(cell.cell));
  }
  return button;
}

// Tiles are created once and updated in place, so focus and styling stay put between clicks.
function render(card) {
  if (grid.children.length !== card.cells.length) {
    grid.replaceChildren(...card.cells.map(makeCell));
  }
  card.cells.forEach((cell, i) => {
    const button = grid.children[i];
    if (!cell.free) {
      if (button.textContent !== cell.word) button.textContent = cell.word;
      button.setAttribute("aria-pressed", String(cell.marked));
    }
    button.classList.toggle("marked", cell.marked);
  });
  banner.hidden = !card.bingo;
  who.textContent = card.label;
  const hits = card.cells.filter((c) => c.marked && !c.free).length;
  const pct = Math.round((hits / 24) * 100);
  stats.textContent = "";
  stats.append(`AGI `);
  const value = document.createElement("b");
  value.textContent = `${pct}%`;
  stats.append(value, ` · ${hits}/24`);
  agiBar.style.width = `${pct}%`;
  agiMeter.setAttribute("aria-valuenow", String(pct));
  if (document.activeElement !== input) input.value = card.nickname;
}

async function api(path, options) {
  const response = await fetch(path, { credentials: "same-origin", ...options });
  const body = await response.json().catch(() => ({}));
  return { response, body };
}

async function load() {
  const { response, body } = await api("/api/card");
  if (!response.ok) return showError("Could not load your card.");
  showError("");
  render(body);
}

async function mark(cell) {
  const { response, body } = await api("/api/mark", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ cell }),
  });
  if (response.status === 401) return load(); // cookie was rejected: start over with a fresh card
  if (!response.ok) return showError(body.error ?? "Could not mark the cell.");
  showError("");
  render(body);
  if (body.newBingo) confetti();
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  hint.textContent = "";
  const { response, body } = await api("/api/nickname", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nickname: input.value }),
  });
  if (response.status === 401) return load();
  if (!response.ok) {
    hint.textContent = body.error ?? "Could not save the name.";
    return;
  }
  hint.textContent = "Saved.";
  render(body);
});

load();

// Burst of glowing sparks for a player's first bingo. Skipped for reduced-motion users.
function confetti() {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const canvas = document.createElement("canvas");
  canvas.id = "confetti";
  canvas.width = innerWidth;
  canvas.height = innerHeight;
  document.body.append(canvas);
  const ctx = canvas.getContext("2d");
  const colors = ["#ffffff", "#d6e8ff", "#9ec5ff", "#a78bfa", "#5eead4"];
  const pieces = Array.from({ length: 140 }, () => ({
    x: innerWidth / 2 + (Math.random() - 0.5) * 120,
    y: innerHeight * 0.45,
    vx: (Math.random() - 0.5) * 16,
    vy: -Math.random() * 15 - 4,
    size: 5 + Math.random() * 6,
    spin: Math.random() * Math.PI,
    color: colors[Math.floor(Math.random() * colors.length)],
  }));
  const start = performance.now();
  (function frame(now) {
    const t = now - start;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const p of pieces) {
      p.vy += 0.38;
      p.x += p.vx;
      p.y += p.vy;
      p.spin += 0.2;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.spin);
      ctx.fillStyle = p.color;
      ctx.globalAlpha = Math.max(0, 1 - t / 2600);
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(0, 0, p.size / 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    if (t < 2600) requestAnimationFrame(frame);
    else canvas.remove();
  })(start);
}

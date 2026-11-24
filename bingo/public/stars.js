// Starfield: twinkling stars that drift slowly, plus an occasional shooting star.
// Purely decorative. With "reduce motion" it draws one still frame.

const canvas = document.createElement("canvas");
canvas.id = "stars";
canvas.setAttribute("aria-hidden", "true");
document.body.prepend(canvas);
const ctx = canvas.getContext("2d");
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

let width = 0;
let height = 0;
let dpr = 1;
let stars = [];
let shooting = null;
let nextShot = performance.now() + 3000;

const TINTS = ["255,255,255", "255,255,255", "190,215,255", "215,200,255", "180,240,255"];

function resize() {
  dpr = Math.min(devicePixelRatio || 1, 2);
  width = innerWidth;
  height = innerHeight;
  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const count = Math.min(560, Math.floor((width * height) / 2200));
  stars = Array.from({ length: count }, () => {
    const depth = Math.random(); // 0 = far, 1 = near
    return {
      x: Math.random() * width,
      y: Math.random() * height,
      r: 0.3 + depth * 1.3,
      base: 0.3 + depth * 0.7,
      speed: 0.4 + Math.random() * 1.6,
      phase: Math.random() * Math.PI * 2,
      drift: 0.004 + depth * 0.02,
      tint: TINTS[Math.floor(Math.random() * TINTS.length)],
    };
  });
}

function spawnShootingStar(now) {
  const fromLeft = Math.random() < 0.5;
  shooting = {
    x: fromLeft ? Math.random() * width * 0.5 : width * 0.5 + Math.random() * width * 0.5,
    y: Math.random() * height * 0.4,
    vx: (fromLeft ? 1 : -1) * (7 + Math.random() * 5),
    vy: 3 + Math.random() * 3,
    born: now,
  };
}

function draw(now) {
  ctx.clearRect(0, 0, width, height);

  for (const s of stars) {
    const twinkle = reduced ? 1 : 0.55 + 0.45 * Math.sin(now * 0.001 * s.speed + s.phase);
    if (!reduced) {
      s.y -= s.drift;
      if (s.y < -2) s.y = height + 2;
    }
    const alpha = s.base * twinkle;
    ctx.fillStyle = `rgba(${s.tint},${alpha})`;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fill();
    if (s.r > 1.1) {
      // soft halo on the brightest stars
      ctx.fillStyle = `rgba(${s.tint},${alpha * 0.12})`;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r * 3.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  if (!reduced) {
    if (!shooting && now > nextShot) spawnShootingStar(now);
    if (shooting) {
      const age = now - shooting.born;
      shooting.x += shooting.vx;
      shooting.y += shooting.vy;
      const fade = Math.max(0, 1 - age / 900);
      const tailX = shooting.x - shooting.vx * 9;
      const tailY = shooting.y - shooting.vy * 9;
      const trail = ctx.createLinearGradient(tailX, tailY, shooting.x, shooting.y);
      trail.addColorStop(0, "rgba(180,215,255,0)");
      trail.addColorStop(1, `rgba(255,255,255,${fade})`);
      ctx.strokeStyle = trail;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(tailX, tailY);
      ctx.lineTo(shooting.x, shooting.y);
      ctx.stroke();
      if (age > 900) {
        shooting = null;
        nextShot = now + 5000 + Math.random() * 8000;
      }
    }
  }
}

function loop(now) {
  if (!document.hidden) draw(now);
  requestAnimationFrame(loop);
}

resize();
addEventListener("resize", resize);
if (reduced) draw(0);
else requestAnimationFrame(loop);

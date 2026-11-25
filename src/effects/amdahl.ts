function update() {
  const p = document.getElementById("amdahl-p") as HTMLInputElement | null;
  const s = document.getElementById("amdahl-s") as HTMLInputElement | null;
  if (!p || !s) return;

  const share = Number(p.value) / 100; // fraction of the work that gets faster
  const factor = 10 ** Number(s.value); // how much faster it gets (1x to 1000x)
  const speedup = 1 / (1 - share + share / factor);

  const set = (key: string, text: string) =>
    document
      .querySelectorAll(`[data-amdahl="${key}"]`)
      .forEach((el) => (el.textContent = text));

  set("p", share.toFixed(2));
  set(
    "s",
    factor >= 100 ? factor.toFixed(0) : factor.toFixed(1).replace(/\.0$/, ""),
  );
  set("speedup", `${speedup.toFixed(2)}×`);
}

const isAmdahlSlider = (t: EventTarget | null) =>
  t instanceof HTMLInputElement && (t.id === "amdahl-p" || t.id === "amdahl-s");

export function initAmdahl() {
  // live update while dragging
  document.addEventListener("input", (e) => {
    if (isAmdahlSlider(e.target)) update();
  });

  // after a mouse drag, hand the keyboard back to the deck so the next arrow key
  // changes the slide (keyboard focus via Tab still lets the arrows move the slider)
  document.addEventListener("pointerup", (e) => {
    if (isAmdahlSlider(e.target)) (e.target as HTMLInputElement).blur();
  });

  // while a slider has keyboard focus, arrow keys move the slider, not the slide
  document.addEventListener(
    "keydown",
    (e) => {
      if (isAmdahlSlider(e.target)) e.stopPropagation();
    },
    true,
  );

  update(); // sync the display with the slider positions
}

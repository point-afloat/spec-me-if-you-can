import Reveal from "reveal.js";
import "reveal.js/reveal.css";
import "reveal.js/theme/dracula.css";
import "./style.css";
import Markdown from "reveal.js/plugin/markdown";
import Highlight from "reveal.js/plugin/highlight";
import RevealMath from "reveal.js/plugin/math";

import { initAmdahl } from "./effects/amdahl";
import Notes from "reveal.js/plugin/notes";

const chapters = import.meta.glob("./slides/*.html", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

const html = Object.keys(chapters)
  .sort()
  .map((path) => chapters[path])
  .join("\n");

document.querySelector(".slides")!.innerHTML = html;

initAmdahl();

const deck = new Reveal({
  hash: true,
  plugins: [Markdown, Highlight, RevealMath, Notes],
  transition: window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ? "none"
    : "fade",
  transitionSpeed: "fast",
  backgroundTransition: "fade",
  controls: true,
  progress: false,
  slideNumber: "c/t",
  center: true,
});

deck.initialize();

// ?export (used by scripts/export-pdf.py) hides the arrows and the slide number
if (new URLSearchParams(location.search).has("export")) {
  document.documentElement.classList.add("export");
}

deck.on("fragmenthidden", () => deck.layout());
deck.on("fragmentshown", () => deck.layout());

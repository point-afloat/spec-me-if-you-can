// First-visit boot sequence: ASCII-art logo plus a typed boot log, then it fades out.
// Classic (non-module) script in <head>, so the page content is hidden before first paint.
// Skip: press any key or click. Replay: add ?boot to the URL. Not shown with reduced motion.
(function () {
  var KEY = "bingo-booted";
  var root = document.documentElement;

  function seen() {
    try {
      return localStorage.getItem(KEY) === "1";
    } catch (e) {
      return false;
    }
  }
  function remember() {
    try {
      localStorage.setItem(KEY, "1");
    } catch (e) {
      /* storage unavailable: the boot just plays again next time */
    }
  }

  var forced = new URLSearchParams(location.search).has("boot");
  var reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduced || !(forced || !seen())) return;

  root.classList.add("booting");

  var ART = [
    "██████╗ ██╗███╗   ██╗ ██████╗  ██████╗ ",
    "██╔══██╗██║████╗  ██║██╔════╝ ██╔═══██╗",
    "██████╔╝██║██╔██╗ ██║██║  ███╗██║   ██║",
    "██╔══██╗██║██║╚██╗██║██║   ██║██║   ██║",
    "██████╔╝██║██║ ╚████║╚██████╔╝╚██████╔╝",
    "╚═════╝ ╚═╝╚═╝  ╚═══╝ ╚═════╝  ╚═════╝ ",
  ];

  // [class, text]
  var LOG = [
    ["dim", "astra-bios v10.0 · POST ........ ok"],
    ["ok", "[  OK  ] mounting /dev/universe"],
    ["ok", "[  OK  ] spawning agentic buzzwords (batch size: yes)"],
    ["ok", "[  OK  ] chmod +x agi.sh && ./agi.sh --10x"],
    ["warn", "[ WARN ] alignment: pending (trust me bro)"],
    ["ok", "[  OK  ] rendering card ........ 5x5 + pizza"],
    ["hi", "> welcome, anon. AGI is 24 words away."],
  ];

  function start() {
    var boot = document.createElement("div");
    boot.className = "boot";
    boot.setAttribute("role", "presentation");

    var art = document.createElement("pre");
    art.className = "boot-art";
    art.setAttribute("aria-hidden", "true");

    var title = document.createElement("p");
    title.className = "boot-title";
    title.textContent = "ARTIFICIAL GENERAL BINGO";

    var log = document.createElement("div");
    log.className = "boot-log";

    var hint = document.createElement("p");
    hint.className = "boot-hint";
    hint.textContent = "press any key to skip";

    boot.append(art, title, log, hint);
    document.body.append(boot);

    var timers = [];
    var done = false;
    function at(ms, fn) {
      timers.push(setTimeout(fn, ms));
    }

    function finish() {
      if (done) return;
      done = true;
      timers.forEach(clearTimeout);
      remember();
      removeEventListener("keydown", finish);
      removeEventListener("pointerdown", finish);
      boot.classList.add("out");
      root.classList.remove("booting");
      setTimeout(function () {
        boot.remove();
      }, 600);
    }
    addEventListener("keydown", finish);
    addEventListener("pointerdown", finish);

    // logo, row by row
    var t = 150;
    ART.forEach(function (_, i) {
      at(t, function () {
        art.textContent = ART.slice(0, i + 1).join("\n");
      });
      t += 90;
    });
    at(t, function () {
      title.classList.add("on");
    });
    t += 250;

    // log lines
    LOG.forEach(function (entry) {
      at(t, function () {
        var line = document.createElement("p");
        line.className = entry[0];
        line.textContent = entry[1];
        log.append(line);
      });
      t += 200;
    });

    at(t + 700, finish);
  }

  if (document.body) start();
  else document.addEventListener("DOMContentLoaded", start);
})();

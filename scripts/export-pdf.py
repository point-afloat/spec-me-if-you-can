#!/usr/bin/env python3
"""Export the deck to a PDF that looks exactly like the screen.

reveal.js' ?print-pdf mode re-flows the slides and breaks the fit-text sizing, the
typing effect and the gradient. This script instead screenshots every slide in a real
browser (headless Chrome, 1920x1080) and assembles the images into a PDF.

Usage:
  npm run dev                      # or serve dist/ (npm run build)
  python3 scripts/export-pdf.py                 # last fragment state of every slide
  python3 scripts/export-pdf.py --steps         # one page per fragment step
  python3 scripts/export-pdf.py --url http://localhost:5173/ --out slides.pdf

Needs: google-chrome, Pillow (pip install pillow). The PDF is made of images
(text is not selectable). Hidden slides (data-visibility="hidden") are skipped.
"""
import argparse, glob, os, re, subprocess, sys, tempfile
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def slides():
    """Yield (fragment_indices) per visible slide, in deck order (flat sections only)."""
    for path in sorted(glob.glob(os.path.join(ROOT, "src/slides/*.html"))):
        text = open(path, encoding="utf-8").read()
        for m in re.finditer(r"<section([^>]*)>(.*?)</section>", text, re.S):
            attrs, body = m.group(1), m.group(2)
            if 'data-visibility="hidden"' in attrs:
                continue
            body = re.sub(r"<aside.*?</aside>", "", body, flags=re.S)
            explicit, auto = [], 0
            for tag in re.findall(r"<[^>]*class=\"[^\"]*\bfragment\b[^\"]*\"[^>]*>", body):
                idx = re.search(r'data-fragment-index="(\d+)"', tag)
                if idx:
                    explicit.append(int(idx.group(1)))
                else:
                    auto += 1
            if explicit:
                steps = sorted(set(explicit))
            else:
                steps = list(range(auto))
            yield steps


def shoot(url, out):
    subprocess.run(
        ["google-chrome", "--headless=new", "--no-sandbox", "--disable-gpu", "--hide-scrollbars",
         "--window-size=1920,1080", "--virtual-time-budget=15000", f"--screenshot={out}", url],
        check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--url", default="http://localhost:5173/")
    ap.add_argument("--out", default=os.path.join(ROOT, "slides.pdf"))
    ap.add_argument("--steps", action="store_true", help="one page per fragment step")
    args = ap.parse_args()
    base = args.url.rstrip("/") + "/?export"

    jobs = []
    for h, steps in enumerate(slides()):
        if not steps:
            jobs.append(f"{base}#/{h}")
        elif args.steps:
            jobs.append(f"{base}#/{h}")  # before the first click
            jobs += [f"{base}#/{h}/0/{f}" for f in steps]
        else:
            jobs.append(f"{base}#/{h}/0/{steps[-1]}")

    with tempfile.TemporaryDirectory() as tmp:
        pages = []
        for n, url in enumerate(jobs, 1):
            png = os.path.join(tmp, f"{n:03d}.png")
            print(f"[{n}/{len(jobs)}] {url}", file=sys.stderr)
            shoot(url, png)
            pages.append(Image.open(png).convert("RGB"))
        pages[0].save(args.out, save_all=True, append_images=pages[1:], resolution=144.0)
    print(f"wrote {args.out} ({len(pages)} pages)")


if __name__ == "__main__":
    main()

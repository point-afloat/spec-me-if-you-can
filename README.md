# Spec Me If You Can!

This repository holds the slides, a live demo app, and the OpenSpec setup the
demo runs on.

## What the talk is about

AI can write code very fast. The talk asks what that does and does not change, and why writing the
*spec* first is the part worth keeping.

1. **Vibe coding.** Where the term comes from (Andrej Karpathy), and three reasons it goes wrong: the intent
   only lives in the chat, there is nothing to check against, and nothing protects what already works.
2. **Engineering.** "At least it's fast, right?" Faster code means more code, and code is not cheap
   (Matt Pocock). Amdahl's law shows why: typing is only part of the job, and knowing what to build and
   knowing it works did not get faster.
3. **OpenSpec.** A spec says *what* the software should do, not *how*. It should be written down,
   checkable and kept. The OpenSpec loop is explore, propose, apply, archive, and a change folder holds
   *why* (`proposal.md`), *what* (`specs/`), *how* (`design.md`) and *steps* (`tasks.md`).
4. **Demo.** The spec for a live leaderboard in the bingo app is already written and checked. An agent
   implements it while the speaker walks through the files.
5. **Where it hurts.** Specs add work to the bottleneck, can turn into waterfall, drift from the code, and
   "specs to code" can let the codebase rot while the scenarios pass.
6. **Close.** The AI can type; you decide what "done" means.


## Repository layout

| Path | What it is |
|---|---|
| `src/slides/` | The slides, one HTML file per chapter (loaded in file-name order) |
| `src/style.css`, `src/main.ts` | Theme (dark, one accent colour) and the reveal.js setup |
| `src/effects/amdahl.ts` | The interactive Amdahl slide (sliders for `p` and `s`) |
| `scripts/export-pdf.py` | PDF export that keeps the on-screen look |
| `bingo/` | The demo app (Node, TypeScript) with its own [README](bingo/README.md) and OpenSpec project |
| `bingo/openspec/` | Living specs, active changes and archived changes of the bingo |

### Branches

| Branch | Contents |
|---|---|
| `main` | The slides and the bingo at v1 |
| `fallback/v2-leaderboard` | The finished v2 implementation: use it if the live demo goes wrong |
| `demo/v2-start` | Demo start state: v1 archived, change `leaderboard-v2` ready with all tasks unticked |

## Run the slides

Needs Node.js 22.18 or newer.

```sh
npm install
npm run dev      # http://localhost:5173
npm run build    # one self-contained dist/index.html
```

In the browser: arrow keys navigate, **S** opens the speaker view with the notes, **B** blanks the screen
(useful when switching to the terminal), **F** goes fullscreen.

The formula on the Amdahl slide is rendered with MathJax loaded from a CDN, so it needs internet access.

### Export to PDF

reveal.js' own `?print-pdf` mode re-flows the slides and breaks the sizing and effects. This script
screenshots every slide instead (needs Google Chrome and `pip install pillow`):

```sh
npm run dev                                   # in one terminal
python3 scripts/export-pdf.py                 # last state of every slide, slides.pdf
python3 scripts/export-pdf.py --steps         # one page per click
```

The PDF consists of images, so text is not selectable. Hidden slides are skipped.

## Set up OpenSpec

[OpenSpec](https://github.com/Fission-AI/OpenSpec) is a spec-driven workflow for AI coding agents. Specs
live in the repository next to the code; the agent proposes a change, you review the spec, the agent
implements it, and the change is merged into the living specs.

### 1. Install the CLI

```sh
npm install -g @fission-ai/openspec@latest
openspec --version
```

(`openspec install` can also install a standalone build that does not need Node.js.)

### 2. Initialize a project

```sh
cd your-project
openspec init --tools claude     # or another tool from `openspec init --help`
```

This creates an `openspec/` folder and installs the commands or skills for your coding agent. The `bingo/`
folder in this repository is already initialized, so you do not need to run this here.

```
openspec/
  specs/             living specs: what the system does today
  changes/
    <change-name>/   an active change
      proposal.md    why
      specs/         the spec deltas: what changes (ADDED / MODIFIED / REMOVED Requirements)
      design.md      how
      tasks.md       steps, as checkboxes
    archive/         finished changes
  config.yaml        project settings
```

### 3. Work with the loop

| Step | What happens |
|---|---|
| **explore** | Think a problem through with the agent before committing to anything |
| **propose** | The agent creates a change with proposal, spec deltas, design and tasks |
| **apply** | The agent implements the tasks and ticks them off |
| **archive** | The deltas are merged into `openspec/specs/` and the change moves to `archive/` |

How you call them depends on the OpenSpec version. Versions 1.x generate slash commands
(`/opsx:explore`, `/opsx:propose`, `/opsx:apply`, `/opsx:archive`, plus `/opsx:update` and `/opsx:sync`).
In 2.0 these became skills (`/openspec-propose`, `/openspec-apply-change`, and so on). The committed
`.claude/` files in `bingo/` were generated by 1.x. After upgrading the CLI, run `openspec update` to regenerate them
and check which names you now have.

The default `core` profile has exactly those six workflows. The expanded profile adds `new`, `continue`,
`ff`, `verify`, `bulk-archive` and `onboard`:

```sh
openspec config profile    # choose the expanded profile
openspec update            # regenerate the agent files
```

### 4. Useful CLI commands

```sh
openspec list                                  # active changes and task progress
openspec validate <change> --strict            # check a change before applying it
openspec archive <change> --yes                # archive without prompts
```

### 5. Project settings

`openspec/config.yaml` holds the project context, per-artifact rules and per-operation guidance. Both
`rules.<artifact>` and `operations.<step>.guidance` must be **lists of strings**. A plain string, or a
mapping nested one level too deep, is ignored with a warning (for example
`Rules for 'apply' must be an array of strings ... rules.apply is a mapping`). The commented examples in
the generated `config.yaml` show the structure:

```yaml
rules:                      # per artifact: proposal, specs, design, tasks
  proposal:
    - Keep proposals under 500 words
operations:                 # advice for how apply and archive are carried out
  apply:
    guidance:
      - Keep test summaries concise
```

Run `openspec instructions apply --change <name> --json` on an active change and check that it prints no
warning about your config.

If your agent setup demands checkpoints (for example a global `CLAUDE.md` that asks it to stop after
sensitive tasks), repo files will not override it. Put the instruction in the prompt itself.

## Run the demo

The live part is the **leaderboard** change of the bingo app (`bingo/openspec/changes/leaderboard-v2`).

1. `git switch demo/v2-start`, then `cd bingo` and `npm install`.
2. Check the specs: `openspec validate leaderboard-v2 --strict`.
3. Clear the agent's context and run the apply step for `leaderboard-v2`. In one timed dry run it took
   about 7.5 minutes without interruption (a single run, so expect variation).
4. While it runs, walk through `proposal.md`, the spec delta, `design.md` and `tasks.md`.
5. If it goes wrong, switch to `fallback/v2-leaderboard`, which contains the finished result.

Notes for the speaker, including a longer run sheet, are in the speaker notes of the Demo slide.

## Sources

- Andrej Karpathy, the post that coined "vibe coding" (2 February 2025):
  <https://x.com/karpathy/status/1886192184808149383>
- Matt Pocock, "Software Fundamentals Matter More Than Ever" (AI Engineer):
  <https://www.youtube.com/watch?v=v4F1gFy-hqg>
- Ivan Turković, "The first 1,000 lines of code determine the next 100,000":
  <https://www.ivanturkovic.com/2026/02/24/first-1000-lines-determine-next-100000-ai-coding/>
- Birgitta Böckeler, spec-first / spec-anchored / spec-as-source:
  <https://martinfowler.com/articles/exploring-gen-ai/sdd-3-tools.html>
- Marc Brooker, "Spec Driven Development isn't Waterfall":
  <https://brooker.co.za/blog/2026/04/09/waterfall-vs-spec>
- François Zaninotto (Marmelab), "Spec-Driven Development: The Waterfall Strikes Back":
  <https://marmelab.com/blog/2025/11/12/spec-driven-development-waterfall-strikes-back.html>
- OpenSpec: <https://github.com/Fission-AI/OpenSpec>

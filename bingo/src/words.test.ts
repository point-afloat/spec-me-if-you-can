import { test } from "node:test";
import assert from "node:assert/strict";
import { WORDS } from "./words.ts";

// Snapshot of the words released in v1. Existing entries must never change or move.
// To grow the list: append to words.ts only. You may extend this snapshot, never edit it.
const RELEASED = [
  "Agentic",
  "RAG",
  "Hallucination",
  "Prompt engineering",
  "Vibe coding",
  "10x engineer",
  "Context window",
  "Fine-tuning",
  "Guardrails",
  "Tokens",
  "MCP",
  "Multimodal",
  "Reasoning model",
  "AGI",
  "Copilot",
  "Foundation model",
  "Embeddings",
  "Vector database",
  "Chain of thought",
  "Evals",
  "Human in the loop",
  "Autonomous agent",
  "Paradigm shift",
  "Game changer",
  "Disruption",
  "Democratizing",
  "Productivity boost",
  "Hype",
  "AI slop",
  "Trust me bro",
  "It works on my machine",
  "Just ask the AI",
  "Prompt injection",
  "Open weights",
  "GPU shortage",
  "Scaling laws",
  "Synthetic data",
  "Zero-shot",
  "Agent swarm",
  "Spec-driven",
  "Technical debt",
  "Replace developers",
  "Stochastic parrot",
  "Moat",
  "Wrapper startup",
  "Prompt chaining",
  "Alignment",
  "Singularity",
];

test("released words keep their positions (append-only)", () => {
  assert.deepEqual(WORDS.slice(0, RELEASED.length), RELEASED);
});

test("list has at least 40 distinct entries", () => {
  assert.ok(WORDS.length >= 40);
  assert.equal(new Set(WORDS).size, WORDS.length);
});

test("ids fit in one byte", () => {
  assert.ok(WORDS.length <= 256);
});

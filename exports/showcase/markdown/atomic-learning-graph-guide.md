# Atomic Learning Graph — a five-step quick tour

A five-step tour of Atomic Learning

Atomic Learning Graph turns open educational text into a small, offline course. It breaks a hard topic into one-concept lessons, puts prerequisites in a useful order, and keeps each explanation beside the source passage that supports it.

This guide uses the same rhythm as the product: one idea at a time, in an order that builds toward a goal.

<a id="choose-a-goal"></a>

## 1. Choose a goal

**Begin with something specific that you want to understand.**

A clear destination keeps the course focused. Atomic Learning works backward from that goal to find the ideas you need first.

> [!tip] Try it
> Name one topic that currently feels too large or tangled to learn all at once.

**Project evidence:** README.md — The whole project, steps 1 and 2

**Next:** [Follow the path](#follow-the-path)

---

<a id="follow-the-path"></a>

## 2. Follow the path

**Learn prerequisites before the ideas that depend on them.**

The graph turns relationships into an ordered route. You can see where you are going and why an earlier idea belongs before a later one.

> [!tip] Try it
> Start at the first item in the map, outline, note list, or deck supplied by your app.

**Project evidence:** src/graph/path.ts — deterministic prerequisite walk

**Next:** [Learn one idea](#learn-one-idea)

---

<a id="learn-one-idea"></a>

## 3. Learn one idea

**Each stop explains one concept in plain language.**

Small lessons reduce the amount you must hold in mind at once. If a lesson feels too hard, step back to its prerequisite instead of pushing through a wall of text.

> [!tip] Try it
> Read one lesson, then explain its single idea in your own words.

**Project evidence:** README.md — Atomic steps and prerequisite scaffolding

**Next:** [Check the receipt](#check-the-receipt)

---

<a id="check-the-receipt"></a>

## 4. Check the receipt

**Every explanation stays close to the source passage that supports it.**

You do not have to trust a smooth explanation just because it sounds confident. Open the source receipt and compare the lesson with the original words.

> [!tip] Try it
> Challenge one explanation by reading the exact quoted passage beside it.

**Project evidence:** src/graph/invariants.ts — quote-primary provenance checks

**Next:** [Take it with you](#take-it-with-you)

---

<a id="take-it-with-you"></a>

## 5. Take it with you

**Use the learning tool you already like.**

The same course can become an Obsidian vault, org-roam file, Tinderbox map, Anki deck, plain Markdown, or an LLM-readable guide. The graph stays the authority; each export is an opinionated presentation for its destination.

> [!tip] Try it
> Open this showcase in another supported app and compare how the same ideas travel.

**Project evidence:** README.md — What ships beyond the reader

## You are ready

You now know the whole loop: choose a goal, follow the path, learn one idea, check the receipt, and keep the course in the tool that works for you.

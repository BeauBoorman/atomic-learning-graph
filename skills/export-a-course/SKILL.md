---
name: export-a-course
description: Export the committed Atomic Learning demo course for Obsidian, org-roam, Anki, Tinderbox, a practice exam, or the optional showcase. Use when a user asks to put the shipped course into a PKM or study tool.
---

# Export the committed course

Use this skill for the **committed demo graph**, not for a separately built one-file HTML course.
The current local builder creates a standalone reader; it does not yet produce PKM export inputs.
Say that plainly if the user asks to export a newly built course, and offer the standalone HTML
instead. Do not invent a conversion path.

From the repository root, install dependencies once if needed:

```sh
pnpm install
```

Choose exactly the format the user requests. The commands below regenerate only the corresponding
derived export from the committed graph; do not hand-edit `data/graph.json` or
`data/renderings.json`.

## Obsidian vault

```sh
pnpm emit:obsidian
```

This writes the linked vault to `exports/obsidian/`. In Obsidian, choose **Open folder as vault**,
select that folder, and begin with `Start Here.md`.

## org-roam

```sh
pnpm emit:orgroam
```

This writes `atomic-learning-graph.org`. Put it in the user's org-roam directory, open it in Emacs,
refresh the org-roam database from Emacs's command palette, then start at **Learning Path**.

## Anki

```sh
pnpm emit:anki
```

This writes `atomic-learning-graph-anki.tsv`. In Anki choose **File → Import**, select the TSV,
keep the **Basic** note type, confirm the deck and tag settings from the file header, then import.

## Tinderbox

```sh
pnpm emit:tinderbox
```

This writes the supported, reproducible `atomic-learning-graph.opml`. In Tinderbox choose
**File → Import…**, select the OPML, open **Concepts** in Map view, and follow the prerequisite
cards. `atomic-learning-graph.tbx` is a hand-finished convenience file, not a regenerated export;
use the OPML when reproducibility matters.

## Practice exam

```sh
pnpm emit:exam
```

This writes `atomic-learning-graph-exam.md`, a Markdown self-check with an answer key and source
passages. Open it in a Markdown reader, answer Parts A and B before scrolling to the key, or print
it. It is not an Anki deck.

## Optional product showcase

```sh
pnpm emit:showcase
```

This writes the optional product tour under `exports/showcase/` in several formats. It is for
onboarding and presentation checking, not a duplicate of the normal learner course.

After any export, report the exact output path and the applicable import steps. Do not claim a
third-party application import was tested just because the emitter completed.

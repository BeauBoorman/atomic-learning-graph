# Learn Atomic Learning in your own app

A five-step tour of Atomic Learning

Atomic Learning Graph turns open educational text into a small, offline course. It breaks a hard topic into one-concept lessons, puts prerequisites in a useful order, and keeps each explanation beside the source passage that supports it.

## Pick your format

- **Obsidian:** open `obsidian/` as a vault, then open `Start Here.md`. The included Canvas and CSS show the intended presentation.

- **org-roam:** copy `org-roam/atomic-learning-graph-guide.org` into your org-roam directory, run `org-roam-db-sync`, and open the file.

- **Tinderbox:** import `tinderbox/atomic-learning-graph-guide.opml`. The map, prototypes, colors, positions, and links apply during that import.

- **Anki:** import `anki/atomic-learning-graph-guide.tsv`. The file creates its own named deck and applies the showcase tag.

- **Markdown:** open `markdown/atomic-learning-graph-guide.md` anywhere Markdown is supported.

- **LLM tools:** point the tool at `llms/llms.txt`; use `llms/llms-full.txt` for the complete tour.

## Why this folder is separate

This is an optional product tutorial and presentation fixture. Normal course exports stay clean, so people who generate many courses do not receive the same onboarding lesson every time.

## For maintainers

Run `pnpm emit:showcase` to rebuild these files and `pnpm verify:showcase` to check exact bytes. Inspect the showcase in each real application before changing that exporter: the files are deliberately small enough that broken hierarchy, links, metadata, or styling should be obvious.

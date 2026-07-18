---
id: "attention-pooling"
title: "Attention Pooling"
source: "d2l-queries-keys-values"
source_title: "Dive into Deep Learning — 11.1 Queries, Keys, and Values"
url: "https://github.com/d2l-ai/d2l-en/blob/b2e2ae30898a9d0126a9699ae7e441de3e272715/chapter_attention-mechanisms-and-transformers/queries-keys-values.md"
author: "Aston Zhang, Zachary C. Lipton, Mu Li, and Alexander J. Smola"
license: "CC-BY-SA-4.0"
modification_notice: "Adapted (translated to plain English; atomized into concept lessons) from Dive into Deep Learning — 11.1 Queries, Keys, and Values by Aston Zhang, Zachary C. Lipton, Mu Li, and Alexander J. Smola, CC-BY-SA-4.0."
tags:
  - "attention"
  - "attention pooling"
  - "query-key compatibility"
  - "weighted combination"
---

Attention pooling combines values linearly using weights determined by query–key compatibility.

## Prerequisites

- [[qkv]]

## Source

Source: d2l-queries-keys-values

URL: https://github.com/d2l-ai/d2l-en/blob/b2e2ae30898a9d0126a9699ae7e441de3e272715/chapter_attention-mechanisms-and-transformers/queries-keys-values.md

> The attention mechanism computes a linear combination over values $\mathbf{v}_\mathit{i}$ via attention pooling, where weights are derived according to the compatibility between a query $\mathbf{q}$ and keys $\mathbf{k}_\mathit{i}$.

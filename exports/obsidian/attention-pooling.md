---
id: "attention-pooling"
title: "Attention Pooling"
source: "d2l-queries-keys-values"
source_title: "Dive into Deep Learning — 11.1 Queries, Keys, and Values"
url: "https://github.com/d2l-ai/d2l-en/blob/b2e2ae30898a9d0126a9699ae7e441de3e272715/chapter_attention-mechanisms-and-transformers/queries-keys-values.md"
author: "Aston Zhang, Zachary C. Lipton, Mu Li, and Alexander J. Smola"
license: "CC-BY-SA-4.0"
license_deed: "https://creativecommons.org/licenses/by-sa/4.0/"
modification_notice: "Adapted (translated to plain English; atomized into concept lessons) from Dive into Deep Learning — 11.1 Queries, Keys, and Values by Aston Zhang, Zachary C. Lipton, Mu Li, and Alexander J. Smola, CC-BY-SA-4.0 (https://creativecommons.org/licenses/by-sa/4.0/)."
tags:
  - "attention"
  - "pooling"
  - "weighted-combinations"
---

# Attention Pooling

Attention pooling combines values linearly using weights determined by query–key compatibility.

## Prerequisites

- [[qkv]]

## Lesson: Combining Values by Relevance

### Step 1 · core

Attention pooling makes a linear combination of values. Its weights come from how compatible the query is with each key.

**Source receipt — `d2l-queries-keys-values`**

> The attention mechanism computes a linear combination over values $\mathbf{v}_\mathit{i}$ via attention pooling, where weights are derived according to the compatibility between a query $\mathbf{q}$ and keys $\mathbf{k}_\mathit{i}$.

### Step 2 · deep

When the weights are nonnegative and add up to 1, large weights can be viewed as the model selecting relevant parts—but this is only an intuition.

**Source receipt — `d2l-queries-keys-values`**

> In this case we might interpret large weights as a way for the model to select components of relevance. While this is a good intuition, it is important to remember that it is just that, an intuition.

### Step 3 · deep

Attention pooling can work with databases of any size without changing how the operation is performed.

**Source receipt — `d2l-queries-keys-values`**

> Just as convenient is the fact that attention can operate on arbitrarily large databases without the need to change the way the attention pooling operation is performed.

## Source

Source: d2l-queries-keys-values

URL: https://github.com/d2l-ai/d2l-en/blob/b2e2ae30898a9d0126a9699ae7e441de3e272715/chapter_attention-mechanisms-and-transformers/queries-keys-values.md

> The attention mechanism computes a linear combination over values $\mathbf{v}_\mathit{i}$ via attention pooling, where weights are derived according to the compatibility between a query $\mathbf{q}$ and keys $\mathbf{k}_\mathit{i}$.

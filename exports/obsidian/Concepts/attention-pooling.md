---
title: "Attention Pooling"
aliases:
  - "Attention Pooling"
tags:
  - "attention"
  - "concept"
  - "pooling"
  - "weighted-combinations"
source: "[[Sources/d2l-queries-keys-values]]"
prerequisites:
  - "[[Concepts/qkv]]"
license: "CC-BY-SA-4.0"
license_deed: "https://creativecommons.org/licenses/by-sa/4.0/"
modification_notice: "Adapted (translated to plain English; atomized into concept lessons) from Dive into Deep Learning — 11.1 Queries, Keys, and Values by Aston Zhang, Zachary C. Lipton, Mu Li, and Alexander J. Smola, CC-BY-SA-4.0 (https://creativecommons.org/licenses/by-sa/4.0/)."
---

# Attention Pooling

Attention pooling combines values linearly using weights determined by query–key compatibility.

## Prerequisites

- [[Concepts/qkv|Queries, Keys, and Values]]

## Lesson: Combining Values by Relevance

### Step 1 · core

Attention pooling makes a linear combination of values. Its weights come from how compatible the query is with each key.

**Source receipt — [[Sources/d2l-queries-keys-values|Dive into Deep Learning — 11.1 Queries, Keys, and Values]]**

> The attention mechanism computes a linear combination over values $\mathbf{v}_\mathit{i}$ via attention pooling, where weights are derived according to the compatibility between a query $\mathbf{q}$ and keys $\mathbf{k}_\mathit{i}$.

### Step 2 · deep

When the weights are nonnegative and add up to 1, large weights can be viewed as the model selecting relevant parts—but this is only an intuition.

**Source receipt — [[Sources/d2l-queries-keys-values|Dive into Deep Learning — 11.1 Queries, Keys, and Values]]**

> In this case we might interpret large weights as a way for the model to select components of relevance. While this is a good intuition, it is important to remember that it is just that, an intuition.

### Step 3 · deep

Attention pooling can work with databases of any size without changing how the operation is performed.

**Source receipt — [[Sources/d2l-queries-keys-values|Dive into Deep Learning — 11.1 Queries, Keys, and Values]]**

> Just as convenient is the fact that attention can operate on arbitrarily large databases without the need to change the way the attention pooling operation is performed.

## Source

Adapted from [[Sources/d2l-queries-keys-values|Dive into Deep Learning — 11.1 Queries, Keys, and Values]].

> The attention mechanism computes a linear combination over values $\mathbf{v}_\mathit{i}$ via attention pooling, where weights are derived according to the compatibility between a query $\mathbf{q}$ and keys $\mathbf{k}_\mathit{i}$.

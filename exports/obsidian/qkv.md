---
id: "qkv"
title: "Queries, Keys, and Values"
source: "d2l-queries-keys-values"
source_title: "Dive into Deep Learning — 11.1 Queries, Keys, and Values"
url: "https://github.com/d2l-ai/d2l-en/blob/b2e2ae30898a9d0126a9699ae7e441de3e272715/chapter_attention-mechanisms-and-transformers/queries-keys-values.md"
author: "Aston Zhang, Zachary C. Lipton, Mu Li, and Alexander J. Smola"
license: "CC-BY-SA-4.0"
license_deed: "https://creativecommons.org/licenses/by-sa/4.0/"
modification_notice: "Adapted (translated to plain English; atomized into concept lessons) from Dive into Deep Learning — 11.1 Queries, Keys, and Values by Aston Zhang, Zachary C. Lipton, Mu Li, and Alexander J. Smola, CC-BY-SA-4.0 (https://creativecommons.org/licenses/by-sa/4.0/)."
tags:
  - "attention"
  - "keys"
  - "queries"
  - "values"
---

# Queries, Keys, and Values

Attention can be framed using a query applied to a collection of key–value pairs.

## Prerequisites

- [[softmax]]

## Lesson: How attention uses queries, keys, and values

### Step 1 · core

Think of the data as a collection of key–value pairs, and call the item used to search or compare against them the query.

**Source receipt — `d2l-queries-keys-values`**

> denote by $\mathcal{D} \stackrel{\textrm{def}}{=} \{(\mathbf{k}_1, \mathbf{v}_1), \ldots (\mathbf{k}_m, \mathbf{v}_m)\}$ a database of $m$ tuples of keys and values. Moreover, denote by $\mathbf{q}$ a query.

### Step 2 · core

Attention gives each value a numeric weight based on its key and the query, then adds the weighted values together.

**Source receipt — `d2l-queries-keys-values`**

> Then we can define the attention over $\mathcal{D}$ as $$\textrm{Attention}(\mathbf{q}, \mathcal{D}) \stackrel{\textrm{def}}{=} \sum_{i=1}^m \alpha(\mathbf{q}, \mathbf{k}_i) \mathbf{v}_i,$$ where $\alpha(\mathbf{q}, \mathbf{k}_i) \in \mathbb{R}$ ($i = 1, \ldots, m$) are scalar attention weights.

### Step 3 · core

A value receives more attention when its weight is large.

**Source receipt — `d2l-queries-keys-values`**

> The name attention derives from the fact that the operation pays particular attention to the terms for which the weight $\alpha$ is significant (i.e., large).

### Step 4 · deep

In the most common deep-learning setup, every weight is nonnegative and all the weights add up to 1.

**Source receipt — `d2l-queries-keys-values`**

> The weights $\alpha(\mathbf{q}, \mathbf{k}_i)$ form a convex combination, i.e., $\sum_i \alpha(\mathbf{q}, \mathbf{k}_i) = 1$ and $\alpha(\mathbf{q}, \mathbf{k}_i) \geq 0$ for all $i$. This is the most common setting in deep learning.

## Source

Source: d2l-queries-keys-values

URL: https://github.com/d2l-ai/d2l-en/blob/b2e2ae30898a9d0126a9699ae7e441de3e272715/chapter_attention-mechanisms-and-transformers/queries-keys-values.md

> For now, simply consider the following: denote by $\mathcal{D} \stackrel{\textrm{def}}{=} \{(\mathbf{k}_1, \mathbf{v}_1), \ldots (\mathbf{k}_m, \mathbf{v}_m)\}$ a database of $m$ tuples of keys and values.

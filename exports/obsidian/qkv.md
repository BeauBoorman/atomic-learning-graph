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

An attention database can be represented as key–value pairs that are accessed using a query.

## Prerequisites

- [[softmax]]

## Lesson: Using a Query with Keys and Values

### Step 1 · core

Think of the data as a collection of key–value pairs.

**Source receipt — `d2l-queries-keys-values`**

> denote by $\mathcal{D} \stackrel{\textrm{def}}{=} \{(\mathbf{k}_1, \mathbf{v}_1), \ldots (\mathbf{k}_m, \mathbf{v}_m)\}$ a database of $m$ tuples of keys and values.

### Step 2 · core

A query is used to assign an attention weight to each key.

**Source receipt — `d2l-queries-keys-values`**

> where $\alpha(\mathbf{q}, \mathbf{k}_i) \in \mathbb{R}$ ($i = 1, \ldots, m$) are scalar attention weights.

### Step 3 · core

Attention pooling combines the stored values into a weighted sum.

**Source receipt — `d2l-queries-keys-values`**

> As such, the attention over $\mathcal{D}$ generates a linear combination of values contained in the database.

### Step 4 · deep

A larger weight means the operation pays more attention to that value.

**Source receipt — `d2l-queries-keys-values`**

> The name attention derives from the fact that the operation pays particular attention to the terms for which the weight $\alpha$ is significant (i.e., large).

## Source

Source: d2l-queries-keys-values

URL: https://github.com/d2l-ai/d2l-en/blob/b2e2ae30898a9d0126a9699ae7e441de3e272715/chapter_attention-mechanisms-and-transformers/queries-keys-values.md

> For now, simply consider the following: denote by $\mathcal{D} \stackrel{\textrm{def}}{=} \{(\mathbf{k}_1, \mathbf{v}_1), \ldots (\mathbf{k}_m, \mathbf{v}_m)\}$ a database of $m$ tuples of keys and values.

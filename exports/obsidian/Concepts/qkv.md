---
title: "Queries, Keys, and Values"
aliases:
  - "Queries, Keys, and Values"
tags:
  - "attention"
  - "concept"
  - "keys"
  - "queries"
  - "values"
source: "[[Sources/d2l-queries-keys-values]]"
prerequisites:
  - "[[Concepts/softmax]]"
license: "CC-BY-SA-4.0"
license_deed: "https://creativecommons.org/licenses/by-sa/4.0/"
modification_notice: "Adapted (translated to plain English; atomized into concept lessons) from Dive into Deep Learning — 11.1 Queries, Keys, and Values by Aston Zhang, Zachary C. Lipton, Mu Li, and Alexander J. Smola, CC-BY-SA-4.0 (https://creativecommons.org/licenses/by-sa/4.0/)."
---

# Queries, Keys, and Values

Attention uses a query to determine compatibility with keys associated with stored values.

## Prerequisites

- [[Concepts/softmax|Softmax]]

## Lesson: Matching a Request to Stored Information

### Step 1 · core

A short request can guide attention over a large set of stored keys and values.

**Source receipt — [[Sources/d2l-queries-keys-values|Dive into Deep Learning — 11.1 Queries, Keys, and Values]]**

> the actual "code" for executing on the set of keys and values, namely the query, can be quite concise, even though the space to operate on is significant.

### Step 2 · core

A query is the request being matched, keys are the items it is compared with, and values are the stored information that attention mixes based on those matches.

**Source receipt — [[Sources/d2l-queries-keys-values|Dive into Deep Learning — 11.1 Queries, Keys, and Values]]**

> The attention mechanism computes a linear combination over values $\mathbf{v}_\mathit{i}$ via attention pooling, where weights are derived according to the compatibility between a query $\mathbf{q}$ and keys $\mathbf{k}_\mathit{i}$.

### Step 3 · core

Suppose two values are 8 and 4, and matching gives them weights of 1/4 and 3/4. Their weighted mix is (1/4 × 8) + (3/4 × 4) = 2 + 3 = 5.

**Source receipt — [[Sources/d2l-queries-keys-values|Dive into Deep Learning — 11.1 Queries, Keys, and Values]]**

> The attention mechanism computes a linear combination over values $\mathbf{v}_\mathit{i}$ via attention pooling, where weights are derived according to the compatibility between a query $\mathbf{q}$ and keys $\mathbf{k}_\mathit{i}$.

### Step 4 · deep

Picture asking a librarian a question: the query is your question, the keys act like book labels, and a larger weight can be viewed as selecting more relevant information.

**Source receipt — [[Sources/d2l-queries-keys-values|Dive into Deep Learning — 11.1 Queries, Keys, and Values]]**

> In this case we might interpret large weights as a way for the model to select components of relevance.

### Step 5 · core

Precisely, the query is written $\mathbf{q}$, each key is $\mathbf{k}_\mathit{i}$, and each value is $\mathbf{v}_\mathit{i}$; attention pooling forms a linear combination, meaning it multiplies each value by its weight and adds the results.

**Source receipt — [[Sources/d2l-queries-keys-values|Dive into Deep Learning — 11.1 Queries, Keys, and Values]]**

> The attention mechanism computes a linear combination over values $\mathbf{v}_\mathit{i}$ via attention pooling, where weights are derived according to the compatibility between a query $\mathbf{q}$ and keys $\mathbf{k}_\mathit{i}$.

## Source

Adapted from [[Sources/d2l-queries-keys-values|Dive into Deep Learning — 11.1 Queries, Keys, and Values]].

> The attention mechanism computes a linear combination over values $\mathbf{v}_\mathit{i}$ via attention pooling, where weights are derived according to the compatibility between a query $\mathbf{q}$ and keys $\mathbf{k}_\mathit{i}$.

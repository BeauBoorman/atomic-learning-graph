---
title: "Attention Pooling"
aliases:
  - "Attention Pooling"
tags:
  - "attention"
  - "concept"
  - "pooling"
source: "[[Sources/d2l-queries-keys-values]]"
prerequisites:
  - "[[Concepts/qkv]]"
license: "CC-BY-SA-4.0"
license_deed: "https://creativecommons.org/licenses/by-sa/4.0/"
modification_notice: "Adapted (translated to plain English; atomized into concept lessons) from Dive into Deep Learning — 11.1 Queries, Keys, and Values by Aston Zhang, Zachary C. Lipton, Mu Li, and Alexander J. Smola, CC-BY-SA-4.0 (https://creativecommons.org/licenses/by-sa/4.0/)."
---

# Attention Pooling

Attention pooling generates a linear combination of values in a key–value database.

## Prerequisites

- [[Concepts/qkv|Queries, Keys, and Values]]

## Lesson: Blending Stored Answers by Relevance

### Step 1 · core

Attention pooling lets you blend stored values into one useful result.

**Source receipt — [[Sources/d2l-queries-keys-values|Dive into Deep Learning — 11.1 Queries, Keys, and Values]]**

> As such, the attention over $\mathcal{D}$ generates a linear combination of values contained in the database.

### Step 2 · core

It makes a linear combination: multiply each stored value by its weight, meaning its assigned share, and then add the results.

**Source receipt — [[Sources/d2l-queries-keys-values|Dive into Deep Learning — 11.1 Queries, Keys, and Values]]**

> As such, the attention over $\mathcal{D}$ generates a linear combination of values contained in the database.

### Step 3 · core

Suppose the stored values are 10 and 20, with weights 0.25 and 0.75. The pooled result is 0.25 × 10 + 0.75 × 20 = 2.5 + 15 = 17.5.

**Source receipt — [[Sources/d2l-queries-keys-values|Dive into Deep Learning — 11.1 Queries, Keys, and Values]]**

> As such, the attention over $\mathcal{D}$ generates a linear combination of values contained in the database.

### Step 4 · deep

Picture mixing drinks: when every stored value gets the same-sized scoop, attention pooling simply finds their average.

**Source receipt — [[Sources/d2l-queries-keys-values|Dive into Deep Learning — 11.1 Queries, Keys, and Values]]**

> All weights are equal, i.e., $\alpha(\mathbf{q}, \mathbf{k}_i) = \frac{1}{m}$ for all $i$. This amounts to averaging across the entire database, also called average pooling in deep learning.

### Step 5 · core

In the most common deep-learning version, every weight is zero or greater, and all the weights add up to 1.

**Source receipt — [[Sources/d2l-queries-keys-values|Dive into Deep Learning — 11.1 Queries, Keys, and Values]]**

> The weights $\alpha(\mathbf{q}, \mathbf{k}_i)$ form a convex combination, i.e., $\sum_i \alpha(\mathbf{q}, \mathbf{k}_i) = 1$ and $\alpha(\mathbf{q}, \mathbf{k}_i) \geq 0$ for all $i$. This is the most common setting in deep learning.

## Source

Adapted from [[Sources/d2l-queries-keys-values|Dive into Deep Learning — 11.1 Queries, Keys, and Values]].

> As such, the attention over $\mathcal{D}$ generates a linear combination of values contained in the database.

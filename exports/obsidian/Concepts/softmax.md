---
title: "Softmax"
aliases:
  - "Softmax"
tags:
  - "classification"
  - "concept"
  - "probabilities"
  - "softmax"
source: "[[Sources/d2l-softmax-regression]]"
prerequisites:
  - "[[Concepts/dot-product]]"
license: "CC-BY-SA-4.0"
license_deed: "https://creativecommons.org/licenses/by-sa/4.0/"
modification_notice: "Adapted (translated to plain English; atomized into concept lessons) from Dive into Deep Learning — 4.1 Softmax Regression by Aston Zhang, Zachary C. Lipton, Mu Li, and Alexander J. Smola, CC-BY-SA-4.0 (https://creativecommons.org/licenses/by-sa/4.0/)."
---

# Softmax

Softmax converts model outputs into a normalized probability distribution by exponentiating and dividing by the sum.

## Prerequisites

- [[Concepts/dot-product|Dot Product]]

## Lesson: Turning Scores into Chances That Add to One

### Step 1 · core

Softmax lets you turn a group of raw scores into chances that add up to 1.

**Source receipt — [[Sources/d2l-softmax-regression|Dive into Deep Learning — 4.1 Softmax Regression]]**

> Putting these two pieces together gives us the softmax function: $$\hat{\mathbf{y}} = \mathrm{softmax}(\mathbf{o}) \quad \textrm{where}\quad \hat{y}_i = \frac{\exp(o_i)}{\sum_j \exp(o_j)}.$$

### Step 2 · core

For each score, softmax first calculates exp(score)—meaning about 2.718 raised to that score—and then divides the result by the total of all such results.

**Source receipt — [[Sources/d2l-softmax-regression|Dive into Deep Learning — 4.1 Softmax Regression]]**

> \hat{y}_i = \frac{\exp(o_i)}{\sum_j \exp(o_j)}

### Step 3 · core

Try scores 0 and 0: exp(0) = 1 for each, their total is 1 + 1 = 2, and softmax gives 1 ÷ 2 = 0.5 for each.

**Source receipt — [[Sources/d2l-softmax-regression|Dive into Deep Learning — 4.1 Softmax Regression]]**

> \hat{y}_i = \frac{\exp(o_i)}{\sum_j \exp(o_j)}

### Step 4 · deep

Picture dividing a whole pie: each transformed score gets a slice equal to its part of the shared total.

**Source receipt — [[Sources/d2l-softmax-regression|Dive into Deep Learning — 4.1 Softmax Regression]]**

> \hat{y}_i = \frac{\exp(o_i)}{\sum_j \exp(o_j)}

### Step 5 · core

Precisely, if o_i means score i, then its softmax result is ŷ_i = exp(o_i) ÷ Σ_j exp(o_j), where Σ_j means “add the transformed results for every score.”

**Source receipt — [[Sources/d2l-softmax-regression|Dive into Deep Learning — 4.1 Softmax Regression]]**

> Putting these two pieces together gives us the softmax function: $$\hat{\mathbf{y}} = \mathrm{softmax}(\mathbf{o}) \quad \textrm{where}\quad \hat{y}_i = \frac{\exp(o_i)}{\sum_j \exp(o_j)}.$$

## Source

Adapted from [[Sources/d2l-softmax-regression|Dive into Deep Learning — 4.1 Softmax Regression]].

> Putting these two pieces together gives us the softmax function: $$\hat{\mathbf{y}} = \mathrm{softmax}(\mathbf{o}) \quad \textrm{where}\quad \hat{y}_i = \frac{\exp(o_i)}{\sum_j \exp(o_j)}.$$

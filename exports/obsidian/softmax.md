---
id: "softmax"
title: "Softmax"
source: "d2l-softmax-regression"
source_title: "Dive into Deep Learning — 4.1 Softmax Regression"
url: "https://github.com/d2l-ai/d2l-en/blob/b2e2ae30898a9d0126a9699ae7e441de3e272715/chapter_linear-classification/softmax-regression.md"
author: "Aston Zhang, Zachary C. Lipton, Mu Li, and Alexander J. Smola"
license: "CC-BY-SA-4.0"
license_deed: "https://creativecommons.org/licenses/by-sa/4.0/"
modification_notice: "Adapted (translated to plain English; atomized into concept lessons) from Dive into Deep Learning — 4.1 Softmax Regression by Aston Zhang, Zachary C. Lipton, Mu Li, and Alexander J. Smola, CC-BY-SA-4.0 (https://creativecommons.org/licenses/by-sa/4.0/)."
tags:
  - "classification"
  - "normalization"
  - "probabilities"
  - "softmax"
---

# Softmax

Softmax exponentiates scores and normalizes them into values that sum to one.

## Prerequisites

- [[dot-product]]

## Lesson: Turning scores into values that add up to one

### Step 1 · core

Softmax first applies the exponential function to each score, then divides each result by the sum of all the exponentiated scores.

**Source receipt — `d2l-softmax-regression`**

> Putting these two pieces together gives us the softmax function: $$\hat{\mathbf{y}} = \mathrm{softmax}(\mathbf{o}) \quad \textrm{where}\quad \hat{y}_i = \frac{\exp(o_i)}{\sum_j \exp(o_j)}.$$

### Step 2 · core

Dividing each value by their sum makes the resulting values add up to 1. This is called normalization.

**Source receipt — `d2l-softmax-regression`**

> We can then transform these values so that they add up to $1$ by dividing each by their sum. This process is called normalization.

### Step 3 · deep

The largest original score corresponds to the class that softmax considers most likely.

**Source receipt — `d2l-softmax-regression`**

> Note that the largest coordinate of $\mathbf{o}$ corresponds to the most likely class according to $\hat{\mathbf{y}}$.

## Source

Source: d2l-softmax-regression

URL: https://github.com/d2l-ai/d2l-en/blob/b2e2ae30898a9d0126a9699ae7e441de3e272715/chapter_linear-classification/softmax-regression.md

> We can then transform these values so that they add up to $1$ by dividing each by their sum.

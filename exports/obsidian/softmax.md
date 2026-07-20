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
  - "probabilities"
  - "softmax"
---

# Softmax

Softmax exponentiates a collection of outputs and normalizes them into values that sum to one.

## Prerequisites

- [[dot-product]]

## Lesson: Turning scores into normalized values

### Step 1 · core

Softmax exponentiates each input, then divides it by the sum of all the exponentiated inputs.

**Source receipt — `d2l-softmax-regression`**

> Putting these two pieces together gives us the softmax function: $$\hat{\mathbf{y}} = \mathrm{softmax}(\mathbf{o}) \quad \textrm{where}\quad \hat{y}_i = \frac{\exp(o_i)}{\sum_j \exp(o_j)}.$$

### Step 2 · deep

The largest input corresponds to the class that softmax rates as most likely.

**Source receipt — `d2l-softmax-regression`**

> Note that the largest coordinate of $\mathbf{o}$ corresponds to the most likely class according to $\hat{\mathbf{y}}$.

## Source

Source: d2l-softmax-regression

URL: https://github.com/d2l-ai/d2l-en/blob/b2e2ae30898a9d0126a9699ae7e441de3e272715/chapter_linear-classification/softmax-regression.md

> Putting these two pieces together gives us the softmax function: $$\hat{\mathbf{y}} = \mathrm{softmax}(\mathbf{o}) \quad \textrm{where}\quad \hat{y}_i = \frac{\exp(o_i)}{\sum_j \exp(o_j)}.$$

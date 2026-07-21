---
title: "Softmax Preserves Ordering"
aliases:
  - "Softmax Preserves Ordering"
tags:
  - "classification"
  - "concept"
  - "ordering"
  - "softmax"
source: "[[Sources/d2l-softmax-regression]]"
prerequisites:
  - "[[Concepts/softmax]]"
license: "CC-BY-SA-4.0"
license_deed: "https://creativecommons.org/licenses/by-sa/4.0/"
modification_notice: "Adapted (translated to plain English; atomized into concept lessons) from Dive into Deep Learning — 4.1 Softmax Regression by Aston Zhang, Zachary C. Lipton, Mu Li, and Alexander J. Smola, CC-BY-SA-4.0 (https://creativecommons.org/licenses/by-sa/4.0/)."
---

# Softmax Preserves Ordering

Softmax preserves the ordering of its inputs, so the largest input identifies the highest-probability class.

## Prerequisites

- [[Concepts/softmax|Softmax]]

## Lesson: The Biggest Score Stays the Winner

### Step 1 · core

You can find which category gets the highest probability without doing the softmax calculation.

**Source receipt — [[Sources/d2l-softmax-regression|Dive into Deep Learning — 4.1 Softmax Regression]]**

> we do not need to compute the softmax to determine which class has been assigned the highest probability.

### Step 2 · core

Softmax turns scores into probabilities, and it preserves their ordering: a bigger score still leads to a bigger probability.

**Source receipt — [[Sources/d2l-softmax-regression|Dive into Deep Learning — 4.1 Softmax Regression]]**

> the softmax operation preserves the ordering among its arguments

### Step 3 · core

Suppose three categories have scores 2, 5, and 1. Since 5 > 2 > 1, the second category will have the highest probability after softmax; you do not need to calculate the probabilities.

**Source receipt — [[Sources/d2l-softmax-regression|Dive into Deep Learning — 4.1 Softmax Regression]]**

> because the softmax operation preserves the ordering among its arguments, we do not need to compute the softmax to determine which class has been assigned the highest probability.

### Step 4 · deep

Picture a race in which softmax changes everyone’s finish time but not their finishing order. The score in first place remains the probability in first place.

**Source receipt — [[Sources/d2l-softmax-regression|Dive into Deep Learning — 4.1 Softmax Regression]]**

> the softmax operation preserves the ordering among its arguments

### Step 5 · core

Formally, “argmax” means the position of the largest number, ŷⱼ is category j’s probability, and oⱼ is its original score. The equation says that the largest probability and the largest original score occur at the same position.

**Source receipt — [[Sources/d2l-softmax-regression|Dive into Deep Learning — 4.1 Softmax Regression]]**

> Thus, $$
> \operatorname*{argmax}_j \hat y_j = \operatorname*{argmax}_j o_j.
> $$

## Source

Adapted from [[Sources/d2l-softmax-regression|Dive into Deep Learning — 4.1 Softmax Regression]].

> Moreover, because the softmax operation preserves the ordering among its arguments, we do not need to compute the softmax to determine which class has been assigned the highest probability.

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

Softmax preserves the ordering of its inputs, so the largest logit identifies the highest-probability class.

## Prerequisites

- [[Concepts/softmax|Softmax]]

## Lesson: Softmax Keeps Values in the Same Order

### Step 1 · core

Softmax preserves the ordering of its input values.

**Source receipt — [[Sources/d2l-softmax-regression|Dive into Deep Learning — 4.1 Softmax Regression]]**

> the softmax operation preserves the ordering among its arguments

### Step 2 · core

You can identify the class with the highest probability without calculating softmax.

**Source receipt — [[Sources/d2l-softmax-regression|Dive into Deep Learning — 4.1 Softmax Regression]]**

> we do not need to compute the softmax to determine which class has been assigned the highest probability

## Source

Adapted from [[Sources/d2l-softmax-regression|Dive into Deep Learning — 4.1 Softmax Regression]].

> Moreover, because the softmax operation preserves the ordering among its arguments, we do not need to compute the softmax to determine which class has been assigned the highest probability.

---
id: "dot-product"
title: "Dot Product"
source: "d2l-linear-algebra"
source_title: "Dive into Deep Learning — 2.3 Linear Algebra"
url: "https://github.com/d2l-ai/d2l-en/blob/b2e2ae30898a9d0126a9699ae7e441de3e272715/chapter_preliminaries/linear-algebra.md"
author: "Aston Zhang, Zachary C. Lipton, Mu Li, and Alexander J. Smola"
license: "CC-BY-SA-4.0"
license_deed: "https://creativecommons.org/licenses/by-sa/4.0/"
modification_notice: "Adapted (translated to plain English; atomized into concept lessons) from Dive into Deep Learning — 2.3 Linear Algebra by Aston Zhang, Zachary C. Lipton, Mu Li, and Alexander J. Smola, CC-BY-SA-4.0 (https://creativecommons.org/licenses/by-sa/4.0/)."
tags:
  - "dot-product"
  - "inner-product"
  - "linear-algebra"
  - "vectors"
---

# Dot Product

The dot product of two vectors sums the products of elements at corresponding positions.

## Prerequisites

- [[vectors]]

## Lesson: Multiply Matching Numbers, Then Add

### Step 1 · core

For two vectors—ordered lists of numbers—the dot product multiplies numbers in matching positions and adds those products together.

**Source receipt — `d2l-linear-algebra`**

> The dot product of two vectors is a sum over the products of the elements at the same position

### Step 2 · deep

A dot product can represent a weighted sum, where each value is multiplied by its assigned weight.

**Source receipt — `d2l-linear-algebra`**

> the weighted sum of the values in $\mathbf{x}$ according to the weights $\mathbf{w}$ could be expressed as the dot product $\mathbf{x}^\top \mathbf{w}$.

### Step 3 · deep

If the weights are nonnegative and add up to 1, the dot product represents a weighted average.

**Source receipt — `d2l-linear-algebra`**

> When the weights are nonnegative and sum to $1$, i.e., $\left(\sum_{i=1}^{n} {w_i} = 1\right)$, the dot product expresses a weighted average.

## Source

Source: d2l-linear-algebra

URL: https://github.com/d2l-ai/d2l-en/blob/b2e2ae30898a9d0126a9699ae7e441de3e272715/chapter_preliminaries/linear-algebra.md

> Given two vectors $\mathbf{x}, \mathbf{y} \in \mathbb{R}^d$, their dot product $\mathbf{x}^\top \mathbf{y}$ (also known as inner product, $\langle \mathbf{x}, \mathbf{y}  \rangle$) is a sum over the products of the elements at the same position: $\mathbf{x}^\top \mathbf{y} = \sum_{i=1}^{d} x_i y_i$.

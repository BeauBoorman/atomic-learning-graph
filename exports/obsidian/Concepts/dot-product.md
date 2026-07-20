---
title: "Dot Product"
aliases:
  - "Dot Product"
tags:
  - "concept"
  - "dot-product"
  - "linear-algebra"
  - "vectors"
source: "[[Sources/d2l-linear-algebra]]"
prerequisites:
  - "[[Concepts/vectors]]"
license: "CC-BY-SA-4.0"
license_deed: "https://creativecommons.org/licenses/by-sa/4.0/"
modification_notice: "Adapted (translated to plain English; atomized into concept lessons) from Dive into Deep Learning — 2.3 Linear Algebra by Aston Zhang, Zachary C. Lipton, Mu Li, and Alexander J. Smola, CC-BY-SA-4.0 (https://creativecommons.org/licenses/by-sa/4.0/)."
---

# Dot Product

The dot product sums products of corresponding elements from two vectors.

## Prerequisites

- [[Concepts/vectors|Vectors]]

## Lesson: Multiply Matching Entries, Then Add

### Step 1 · core

The dot product of two vectors is found by multiplying entries in the same position and adding those products.

**Source receipt — [[Sources/d2l-linear-algebra|Dive into Deep Learning — 2.3 Linear Algebra]]**

> The dot product of two vectors is a sum over the products of the elements at the same position

### Step 2 · deep

A weighted sum can be written as the dot product of a vector of values and a vector of weights.

**Source receipt — [[Sources/d2l-linear-algebra|Dive into Deep Learning — 2.3 Linear Algebra]]**

> the weighted sum of the values in $\mathbf{x}$ according to the weights $\mathbf{w}$ could be expressed as the dot product $\mathbf{x}^\top \mathbf{w}$.

### Step 3 · deep

If the weights are nonnegative and add up to 1, the dot product gives a weighted average.

**Source receipt — [[Sources/d2l-linear-algebra|Dive into Deep Learning — 2.3 Linear Algebra]]**

> When the weights are nonnegative and sum to $1$, i.e., $\left(\sum_{i=1}^{n} {w_i} = 1\right)$, the dot product expresses a weighted average.

## Source

Adapted from [[Sources/d2l-linear-algebra|Dive into Deep Learning — 2.3 Linear Algebra]].

> Given two vectors $\mathbf{x}, \mathbf{y} \in \mathbb{R}^d$, their dot product $\mathbf{x}^\top \mathbf{y}$ (also known as inner product, $\langle \mathbf{x}, \mathbf{y}  \rangle$) is a sum over the products of the elements at the same position: $\mathbf{x}^\top \mathbf{y} = \sum_{i=1}^{d} x_i y_i$.

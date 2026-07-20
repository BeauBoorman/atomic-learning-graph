---
title: "Dot Product"
aliases:
  - "Dot Product"
tags:
  - "concept"
  - "dot-product"
  - "linear-algebra"
source: "[[Sources/d2l-linear-algebra]]"
prerequisites:
  - "[[Concepts/vectors]]"
license: "CC-BY-SA-4.0"
license_deed: "https://creativecommons.org/licenses/by-sa/4.0/"
modification_notice: "Adapted (translated to plain English; atomized into concept lessons) from Dive into Deep Learning — 2.3 Linear Algebra by Aston Zhang, Zachary C. Lipton, Mu Li, and Alexander J. Smola, CC-BY-SA-4.0 (https://creativecommons.org/licenses/by-sa/4.0/)."
---

# Dot Product

The dot product sums the products of corresponding elements in two vectors.

## Prerequisites

- [[Concepts/vectors|Vectors]]

## Lesson: Pair, Multiply, Then Add

### Step 1 · core

A dot product lets you combine two matching lists of numbers into one number, and it is useful in many different settings.

**Source receipt — [[Sources/d2l-linear-algebra|Dive into Deep Learning — 2.3 Linear Algebra]]**

> Dot products are useful in a wide range of contexts.

### Step 2 · core

A dot product pairs numbers in the same position, multiplies each pair, and then adds all the results.

**Source receipt — [[Sources/d2l-linear-algebra|Dive into Deep Learning — 2.3 Linear Algebra]]**

> The dot product of two vectors is a sum over the products of the elements at the same position

### Step 3 · core

For the vectors [2, 3] and [4, 5], multiply matching numbers: 2 × 4 = 8 and 3 × 5 = 15. Then add: 8 + 15 = 23, so the dot product is 23.

**Source receipt — [[Sources/d2l-linear-algebra|Dive into Deep Learning — 2.3 Linear Algebra]]**

> we can calculate the dot product of two vectors by performing an elementwise multiplication followed by a sum

### Step 4 · deep

Think of a dot product as a weighted score: one list holds values, while the matching list holds weights—numbers showing how much each value counts.

**Source receipt — [[Sources/d2l-linear-algebra|Dive into Deep Learning — 2.3 Linear Algebra]]**

> the weighted sum of the values in $\mathbf{x}$ according to the weights $\mathbf{w}$ could be expressed as the dot product $\mathbf{x}^\top \mathbf{w}$.

### Step 5 · core

Precisely, let x and y name two vectors with d positions, and let xᵢ and yᵢ mean the numbers at position i. Their dot product is xᵀy = ∑ᵢ₌₁ᵈ xᵢyᵢ, meaning multiply the matching numbers from position 1 through position d and add those products.

**Source receipt — [[Sources/d2l-linear-algebra|Dive into Deep Learning — 2.3 Linear Algebra]]**

> Given two vectors $\mathbf{x}, \mathbf{y} \in \mathbb{R}^d$, their dot product $\mathbf{x}^\top \mathbf{y}$ (also known as inner product, $\langle \mathbf{x}, \mathbf{y}  \rangle$) is a sum over the products of the elements at the same position: $\mathbf{x}^\top \mathbf{y} = \sum_{i=1}^{d} x_i y_i$.

### Step 6 · deep

A matrix–vector product uses this idea repeatedly: each output number is the dot product of one matrix row and the input vector.

**Source receipt — [[Sources/d2l-linear-algebra|Dive into Deep Learning — 2.3 Linear Algebra]]**

> The matrix--vector product $\mathbf{A}\mathbf{x}$ is simply a column vector of length $m$, whose $i^\textrm{th}$ element is the dot product $\mathbf{a}^\top_i \mathbf{x}$

## Source

Adapted from [[Sources/d2l-linear-algebra|Dive into Deep Learning — 2.3 Linear Algebra]].

> Given two vectors $\mathbf{x}, \mathbf{y} \in \mathbb{R}^d$, their dot product $\mathbf{x}^\top \mathbf{y}$ (also known as inner product, $\langle \mathbf{x}, \mathbf{y}  \rangle$) is a sum over the products of the elements at the same position: $\mathbf{x}^\top \mathbf{y} = \sum_{i=1}^{d} x_i y_i$.

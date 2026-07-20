---
title: "Matrix–Vector Product"
aliases:
  - "Matrix–Vector Product"
tags:
  - "concept"
  - "linear-algebra"
  - "matrices"
  - "vectors"
source: "[[Sources/d2l-linear-algebra]]"
prerequisites:
  - "[[Concepts/dot-product]]"
license: "CC-BY-SA-4.0"
license_deed: "https://creativecommons.org/licenses/by-sa/4.0/"
modification_notice: "Adapted (translated to plain English; atomized into concept lessons) from Dive into Deep Learning — 2.3 Linear Algebra by Aston Zhang, Zachary C. Lipton, Mu Li, and Alexander J. Smola, CC-BY-SA-4.0 (https://creativecommons.org/licenses/by-sa/4.0/)."
---

# Matrix–Vector Product

A matrix–vector product produces a vector whose entries are dot products between matrix rows and the input vector.

## Prerequisites

- [[Concepts/dot-product|Dot Product]]

## Lesson: Multiplying a Matrix by a Vector

### Step 1 · core

Multiplying matrix A by vector x produces a column vector of length m. Each entry is the dot product of one row of A with x.

**Source receipt — [[Sources/d2l-linear-algebra|Dive into Deep Learning — 2.3 Linear Algebra]]**

> The matrix--vector product $\mathbf{A}\mathbf{x}$ is simply a column vector of length $m$, whose $i^\textrm{th}$ element is the dot product $\mathbf{a}^\top_i \mathbf{x}$

### Step 2 · core

The number of columns in A must equal the length of x.

**Source receipt — [[Sources/d2l-linear-algebra|Dive into Deep Learning — 2.3 Linear Algebra]]**

> Note that the column dimension of A (its length along axis 1) must be the same as the dimension of x (its length).

### Step 3 · deep

Multiplying by a matrix can be viewed as a transformation that maps a vector with n entries to one with m entries.

**Source receipt — [[Sources/d2l-linear-algebra|Dive into Deep Learning — 2.3 Linear Algebra]]**

> We can think of multiplication with a matrix $\mathbf{A}\in \mathbb{R}^{m \times n}$ as a transformation that projects vectors from $\mathbb{R}^{n}$ to $\mathbb{R}^{m}$.

## Source

Adapted from [[Sources/d2l-linear-algebra|Dive into Deep Learning — 2.3 Linear Algebra]].

> The matrix--vector product $\mathbf{A}\mathbf{x}$ is simply a column vector of length $m$, whose $i^\textrm{th}$ element is the dot product $\mathbf{a}^\top_i \mathbf{x}$: $$
> \mathbf{A}\mathbf{x}
> = \begin{bmatrix}
> \mathbf{a}^\top_{1} \\
> \mathbf{a}^\top_{2} \\
> \vdots \\
> \mathbf{a}^\top_m \\
> \end{bmatrix}\mathbf{x}
> = \begin{bmatrix}
>  \mathbf{a}^\top_{1} \mathbf{x}  \\
>  \mathbf{a}^\top_{2} \mathbf{x} \\
> \vdots\\
>  \mathbf{a}^\top_{m} \mathbf{x}\\
> \end{bmatrix}.
> $$

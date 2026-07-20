---
id: "matrix-vector-product"
title: "Matrix–Vector Product"
source: "d2l-linear-algebra"
source_title: "Dive into Deep Learning — 2.3 Linear Algebra"
url: "https://github.com/d2l-ai/d2l-en/blob/b2e2ae30898a9d0126a9699ae7e441de3e272715/chapter_preliminaries/linear-algebra.md"
author: "Aston Zhang, Zachary C. Lipton, Mu Li, and Alexander J. Smola"
license: "CC-BY-SA-4.0"
license_deed: "https://creativecommons.org/licenses/by-sa/4.0/"
modification_notice: "Adapted (translated to plain English; atomized into concept lessons) from Dive into Deep Learning — 2.3 Linear Algebra by Aston Zhang, Zachary C. Lipton, Mu Li, and Alexander J. Smola, CC-BY-SA-4.0 (https://creativecommons.org/licenses/by-sa/4.0/)."
tags:
  - "linear-algebra"
  - "matrices"
  - "vectors"
---

# Matrix–Vector Product

A matrix–vector product produces a vector whose entries are dot products between matrix rows and the input vector.

## Prerequisites

- [[dot-product]]

## Lesson: Multiplying a Matrix by a Vector

### Step 1 · core

Multiplying matrix A by vector x produces a column vector of length m. Each entry is the dot product of one row of A with x.

**Source receipt — `d2l-linear-algebra`**

> The matrix--vector product $\mathbf{A}\mathbf{x}$ is simply a column vector of length $m$, whose $i^\textrm{th}$ element is the dot product $\mathbf{a}^\top_i \mathbf{x}$

### Step 2 · core

The number of columns in A must equal the length of x.

**Source receipt — `d2l-linear-algebra`**

> Note that the column dimension of A (its length along axis 1) must be the same as the dimension of x (its length).

### Step 3 · deep

Multiplying by a matrix can be viewed as a transformation that maps a vector with n entries to one with m entries.

**Source receipt — `d2l-linear-algebra`**

> We can think of multiplication with a matrix $\mathbf{A}\in \mathbb{R}^{m \times n}$ as a transformation that projects vectors from $\mathbb{R}^{n}$ to $\mathbb{R}^{m}$.

## Source

Source: d2l-linear-algebra

URL: https://github.com/d2l-ai/d2l-en/blob/b2e2ae30898a9d0126a9699ae7e441de3e272715/chapter_preliminaries/linear-algebra.md

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

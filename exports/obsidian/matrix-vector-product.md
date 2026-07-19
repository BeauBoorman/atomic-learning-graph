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
  - "matrix-vector-product"
  - "vectors"
---

# Matrix–Vector Product

A matrix–vector product contains one dot product between the input vector and each row of the matrix.

## Prerequisites

- [[dot-product]]

## Lesson: Multiplying a Matrix by a Vector

### Step 1 · core

The result of multiplying matrix A by vector x is a column vector with m entries.

**Source receipt — `d2l-linear-algebra`**

> The matrix--vector product $\mathbf{A}\mathbf{x}$ is simply a column vector of length $m$

### Step 2 · core

Each entry in the result is the dot product—the sum of paired values multiplied together—of x and the matching row of A.

**Source receipt — `d2l-linear-algebra`**

> whose $i^\textrm{th}$ element is the dot product $\mathbf{a}^\top_i \mathbf{x}$

### Step 3 · core

For the multiplication to work, the number of columns in A must equal the number of entries in x.

**Source receipt — `d2l-linear-algebra`**

> Note that the column dimension of A (its length along axis 1) must be the same as the dimension of x (its length).

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

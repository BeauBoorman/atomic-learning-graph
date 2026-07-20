---
title: "Matrix–Vector Product"
aliases:
  - "Matrix–Vector Product"
tags:
  - "concept"
  - "linear-algebra"
  - "matrix-vector-multiplication"
source: "[[Sources/d2l-linear-algebra]]"
prerequisites:
  - "[[Concepts/dot-product]]"
license: "CC-BY-SA-4.0"
license_deed: "https://creativecommons.org/licenses/by-sa/4.0/"
modification_notice: "Adapted (translated to plain English; atomized into concept lessons) from Dive into Deep Learning — 2.3 Linear Algebra by Aston Zhang, Zachary C. Lipton, Mu Li, and Alexander J. Smola, CC-BY-SA-4.0 (https://creativecommons.org/licenses/by-sa/4.0/)."
---

# Matrix–Vector Product

A matrix–vector product produces a vector whose elements are dot products between matrix rows and the input vector.

## Prerequisites

- [[Concepts/dot-product|Dot Product]]

## Lesson: Turning Matrix Rows into a New Number List

### Step 1 · core

This operation lets you turn one vector into another vector, possibly with a different length.

**Source receipt — [[Sources/d2l-linear-algebra|Dive into Deep Learning — 2.3 Linear Algebra]]**

> We can think of multiplication with a matrix $\mathbf{A}\in \mathbb{R}^{m \times n}$ as a transformation that projects vectors from $\mathbb{R}^{n}$ to $\mathbb{R}^{m}$.

### Step 2 · core

A matrix is a rectangle of numbers. To multiply it by a vector, take the dot product of each horizontal line, called a row, with the vector; those answers form the new vector.

**Source receipt — [[Sources/d2l-linear-algebra|Dive into Deep Learning — 2.3 Linear Algebra]]**

> The matrix--vector product $\mathbf{A}\mathbf{x}$ is simply a column vector of length $m$, whose $i^\textrm{th}$ element is the dot product $\mathbf{a}^\top_i \mathbf{x}$

### Step 3 · core

Try the matrix with rows [2, 1] and [3, 4], and the vector [5, 2]. The first answer is 2×5 + 1×2 = 12, and the second is 3×5 + 4×2 = 23, so the result is [12, 23].

**Source receipt — [[Sources/d2l-linear-algebra|Dive into Deep Learning — 2.3 Linear Algebra]]**

> The matrix--vector product $\mathbf{A}\mathbf{x}$ is simply a column vector of length $m$, whose $i^\textrm{th}$ element is the dot product $\mathbf{a}^\top_i \mathbf{x}$

### Step 4 · deep

Picture each row as a separate worker doing the same job with the input vector; each worker produces one number for the output vector.

**Source receipt — [[Sources/d2l-linear-algebra|Dive into Deep Learning — 2.3 Linear Algebra]]**

> whose $i^\textrm{th}$ element is the dot product $\mathbf{a}^\top_i \mathbf{x}$

### Step 5 · core

Formally, let the matrix be $\mathbf{A}$, the input vector be $\mathbf{x}$, and the number of rows be $m$. Then $\mathbf{A}\mathbf{x}$ is a vector with $m$ numbers, and output number $i$ is the dot product of row $i$ with $\mathbf{x}$.

**Source receipt — [[Sources/d2l-linear-algebra|Dive into Deep Learning — 2.3 Linear Algebra]]**

> The matrix--vector product $\mathbf{A}\mathbf{x}$ is simply a column vector of length $m$, whose $i^\textrm{th}$ element is the dot product $\mathbf{a}^\top_i \mathbf{x}$

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

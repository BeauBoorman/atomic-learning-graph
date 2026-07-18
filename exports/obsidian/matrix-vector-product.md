---
id: "matrix-vector-product"
title: "Matrix–Vector Product"
source: "d2l-linear-algebra"
source_title: "Dive into Deep Learning — 2.3 Linear Algebra"
url: "https://github.com/d2l-ai/d2l-en/blob/b2e2ae30898a9d0126a9699ae7e441de3e272715/chapter_preliminaries/linear-algebra.md"
author: "Aston Zhang, Zachary C. Lipton, Mu Li, and Alexander J. Smola"
license: "CC-BY-SA-4.0"
modification_notice: "Adapted (translated to plain English; atomized into concept lessons) from Dive into Deep Learning — 2.3 Linear Algebra by Aston Zhang, Zachary C. Lipton, Mu Li, and Alexander J. Smola, CC-BY-SA-4.0."
tags:
  - "linear algebra"
  - "matrices"
  - "matrix-vector product"
  - "vectors"
---

A matrix–vector product contains one dot product between the input vector and each row of the matrix.

## Prerequisites

- [[dot-product]]

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

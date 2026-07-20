---
title: "Vector Norm"
aliases:
  - "Vector Norm"
tags:
  - "concept"
  - "linear-algebra"
  - "norms"
source: "[[Sources/d2l-linear-algebra]]"
prerequisites:
  - "[[Concepts/vectors]]"
license: "CC-BY-SA-4.0"
license_deed: "https://creativecommons.org/licenses/by-sa/4.0/"
modification_notice: "Adapted (translated to plain English; atomized into concept lessons) from Dive into Deep Learning — 2.3 Linear Algebra by Aston Zhang, Zachary C. Lipton, Mu Li, and Alexander J. Smola, CC-BY-SA-4.0 (https://creativecommons.org/licenses/by-sa/4.0/)."
---

# Vector Norm

A vector norm measures the magnitude or size of a vector.

## Prerequisites

- [[Concepts/vectors|Vectors]]

## Lesson: Turning a Number List into Its Length

### Step 1 · core

A norm gives you one number that tells you how big a vector is.

**Source receipt — [[Sources/d2l-linear-algebra|Dive into Deep Learning — 2.3 Linear Algebra]]**

> Informally, the norm of a vector tells us how big it is.

### Step 2 · core

A norm is a rule that takes a vector—a fixed list of numbers—and returns a scalar, meaning one ordinary number.

**Source receipt — [[Sources/d2l-linear-algebra|Dive into Deep Learning — 2.3 Linear Algebra]]**

> A norm is a function $\| \cdot \|$ that maps a vector to a scalar

### Step 3 · core

For the vector [3, 4], square each number, add, and take the square root: 3² + 4² = 9 + 16 = 25, and √25 = 5. So its ℓ₂ norm is 5.

**Source receipt — [[Sources/d2l-linear-algebra|Dive into Deep Learning — 2.3 Linear Algebra]]**

> The Euclidean norm that we all learned in elementary school geometry when calculating the hypotenuse of a right triangle is the square root of the sum of squares of a vector's elements.

### Step 4 · deep

Picture walking 3 blocks east and 4 blocks north: the ℓ₂ norm is like the straight-line length from where you started to where you ended.

**Source receipt — [[Sources/d2l-linear-algebra|Dive into Deep Learning — 2.3 Linear Algebra]]**

> For instance, the $\ell_2$ norm measures the (Euclidean) length of a vector.

### Step 5 · core

Precisely, if xᵢ means the number in position i and n means how many numbers there are, then ‖x‖₂ means: square all n numbers, add the squares, and take the square root.

**Source receipt — [[Sources/d2l-linear-algebra|Dive into Deep Learning — 2.3 Linear Algebra]]**

> Formally, this is called the $\ell_2$ norm and expressed as ($$\|\mathbf{x}\|_2 = \sqrt{\sum_{i=1}^n x_i^2}.$$)

## Source

Adapted from [[Sources/d2l-linear-algebra|Dive into Deep Learning — 2.3 Linear Algebra]].

> Informally, the norm of a vector tells us how big it is.

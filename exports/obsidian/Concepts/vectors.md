---
title: "Vectors"
aliases:
  - "Vectors"
tags:
  - "concept"
  - "linear-algebra"
  - "vectors"
source: "[[Sources/d2l-linear-algebra]]"
license: "CC-BY-SA-4.0"
license_deed: "https://creativecommons.org/licenses/by-sa/4.0/"
modification_notice: "Adapted (translated to plain English; atomized into concept lessons) from Dive into Deep Learning — 2.3 Linear Algebra by Aston Zhang, Zachary C. Lipton, Mu Li, and Alexander J. Smola, CC-BY-SA-4.0 (https://creativecommons.org/licenses/by-sa/4.0/)."
---

# Vectors

A vector is a fixed-length array whose elements are scalars.

## Lesson: Keeping a Fixed List of Numbers Together

### Step 1 · core

A vector lets you keep several related real-world measurements together, such as a person’s income and employment length.

**Source receipt — [[Sources/d2l-linear-algebra|Dive into Deep Learning — 2.3 Linear Algebra]]**

> When vectors represent examples from real-world datasets, their values hold some real-world significance.

### Step 2 · core

A vector is a list with a set number of slots, and each slot holds one ordinary number, called a scalar.

**Source receipt — [[Sources/d2l-linear-algebra|Dive into Deep Learning — 2.3 Linear Algebra]]**

> For current purposes, you can think of a vector as a fixed-length array of scalars.

### Step 3 · core

Take the vector [4, 7, 2]. It has three elements, and its second element is 7, so we can write x₂ = 7.

**Source receipt — [[Sources/d2l-linear-algebra|Dive into Deep Learning — 2.3 Linear Algebra]]**

> For example, $x_2$ denotes the second element of $\mathbf{x}$.

### Step 4 · deep

Picture a vector as a card with labeled boxes: one box might hold income, another employment length, and another the number of earlier loan defaults.

**Source receipt — [[Sources/d2l-linear-algebra|Dive into Deep Learning — 2.3 Linear Algebra]]**

> For example, if we were training a model to predict the risk of a loan defaulting, we might associate each applicant with a vector whose components correspond to quantities like their income, length of employment, or number of previous defaults.

### Step 5 · core

Precisely, bold x means the whole vector, while x₁ through xₙ mean its individual numbers; n is the vector’s fixed number of elements.

**Source receipt — [[Sources/d2l-linear-algebra|Dive into Deep Learning — 2.3 Linear Algebra]]**

> Here $x_1, \ldots, x_n$ are elements of the vector.

## Source

Adapted from [[Sources/d2l-linear-algebra|Dive into Deep Learning — 2.3 Linear Algebra]].

> For current purposes, you can think of a vector as a fixed-length array of scalars.

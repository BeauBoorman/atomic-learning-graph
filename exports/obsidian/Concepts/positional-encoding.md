---
title: "Positional Encoding"
aliases:
  - "Positional Encoding"
tags:
  - "concept"
  - "positional-encoding"
  - "self-attention"
  - "sequence-order"
source: "[[Sources/d2l-self-attention]]"
prerequisites:
  - "[[Concepts/self-attention]]"
license: "CC-BY-SA-4.0"
license_deed: "https://creativecommons.org/licenses/by-sa/4.0/"
modification_notice: "Adapted (translated to plain English; atomized into concept lessons) from Dive into Deep Learning — 11.6 Self-Attention and Positional Encoding by Aston Zhang, Zachary C. Lipton, Mu Li, and Alexander J. Smola, CC-BY-SA-4.0 (https://creativecommons.org/licenses/by-sa/4.0/)."
---

# Positional Encoding

Positional encodings provide token-order information to models as additional token-associated inputs.

## Prerequisites

- [[Concepts/self-attention|Self-Attention]]

## Lesson: Giving Each Token Its Place in Line

### Step 1 · core

Positional encoding helps a model keep track of the order of tokens, where a token is one piece of a sequence, such as a word.

**Source receipt — [[Sources/d2l-self-attention|Dive into Deep Learning — 11.6 Self-Attention and Positional Encoding]]**

> The dominant approach for preserving information about the order of tokens is to represent this to the model as an additional input associated with each token.

### Step 2 · core

A positional encoding is extra position information attached to each token. It may be learned during training or fixed ahead of time.

**Source receipt — [[Sources/d2l-self-attention|Dive into Deep Learning — 11.6 Self-Attention and Positional Encoding]]**

> These inputs are called positional encodings, and they can either be learned or fixed a priori.

### Step 3 · core

Suppose a token has the number-list [4, 2], and its position has the number-list [1, 3]. Add matching entries: [4 + 1, 2 + 3] = [5, 5].

**Source receipt — [[Sources/d2l-self-attention|Dive into Deep Learning — 11.6 Self-Attention and Positional Encoding]]**

> The positional encoding outputs $\mathbf{X} + \mathbf{P}$

### Step 4 · deep

Picture a seating chart: each row marks one place in the sequence, while each column stores one kind of position number.

**Source receipt — [[Sources/d2l-self-attention|Dive into Deep Learning — 11.6 Self-Attention and Positional Encoding]]**

> In the positional embedding matrix $\mathbf{P}$, rows correspond to positions within a sequence and columns represent different positional encoding dimensions.

### Step 5 · core

Precisely, let X be the grid of token numbers and P be an equally shaped grid of position numbers. The model receives X + P, found by adding numbers in matching places.

**Source receipt — [[Sources/d2l-self-attention|Dive into Deep Learning — 11.6 Self-Attention and Positional Encoding]]**

> The positional encoding outputs $\mathbf{X} + \mathbf{P}$ using a positional embedding matrix $\mathbf{P} \in \mathbb{R}^{n \times d}$ of the same shape

## Source

Adapted from [[Sources/d2l-self-attention|Dive into Deep Learning — 11.6 Self-Attention and Positional Encoding]].

> The dominant approach for preserving information about the order of tokens is to represent this to the model as an additional input associated with each token.

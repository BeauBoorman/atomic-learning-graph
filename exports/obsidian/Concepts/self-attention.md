---
title: "Self-Attention"
aliases:
  - "Self-Attention"
tags:
  - "attention"
  - "concept"
  - "self-attention"
  - "sequences"
source: "[[Sources/d2l-self-attention]]"
prerequisites:
  - "[[Concepts/qkv]]"
license: "CC-BY-SA-4.0"
license_deed: "https://creativecommons.org/licenses/by-sa/4.0/"
modification_notice: "Adapted (translated to plain English; atomized into concept lessons) from Dive into Deep Learning — 11.6 Self-Attention and Positional Encoding by Aston Zhang, Zachary C. Lipton, Mu Li, and Alexander J. Smola, CC-BY-SA-4.0 (https://creativecommons.org/licenses/by-sa/4.0/)."
---

# Self-Attention

Self-attention lets every token attend to every other token in the same sequence.

## Prerequisites

- [[Concepts/qkv|Queries, Keys, and Values]]

## Lesson: Each Item Looks Across Its Own Sequence

### Step 1 · core

Self-attention lets each token—one item in a sequence, such as a word—use information from every other token in that sequence.

**Source receipt — [[Sources/d2l-self-attention|Dive into Deep Learning — 11.6 Self-Attention and Positional Encoding]]**

> Because every token is attending to each other token

### Step 2 · core

It is called “self-attention” because the tokens attend to, or consider, other tokens from their own sequence when producing results.

**Source receipt — [[Sources/d2l-self-attention|Dive into Deep Learning — 11.6 Self-Attention and Positional Encoding]]**

> such architectures are typically described as self-attention models , and elsewhere described as intra-attention model .

### Step 3 · core

Suppose three tokens have the simple number values 2, 4, and 6. The first token might pay 50% attention to itself, 30% to the second, and 20% to the third: 0.5 × 2 + 0.3 × 4 + 0.2 × 6 = 1 + 1.2 + 1.2 = 3.4. A different token, with different attention weights, gets a different result — that is what makes it attention, not averaging.

**Source receipt — [[Sources/d2l-self-attention|Dive into Deep Learning — 11.6 Self-Attention and Positional Encoding]]**

> its self-attention outputs a sequence of the same length $\mathbf{y}_1, \ldots, \mathbf{y}_n$, where $$\mathbf{y}_i = f(\mathbf{x}_i, (\mathbf{x}_1, \mathbf{x}_1), \ldots, (\mathbf{x}_n, \mathbf{x}_n)) \in \mathbb{R}^d$$ according to the definition of attention pooling in .

### Step 4 · deep

Picture a group discussion where every person can listen to every other person before giving an answer; likewise, every token can attend to every other token.

**Source receipt — [[Sources/d2l-self-attention|Dive into Deep Learning — 11.6 Self-Attention and Positional Encoding]]**

> every token is attending to each other token

### Step 5 · core

Precisely, if the inputs are numbered x₁ through xₙ, self-attention produces equally many outputs, y₁ through yₙ; each output yᵢ is made by a rule f that can use xᵢ and all input pairs from x₁ through xₙ.

**Source receipt — [[Sources/d2l-self-attention|Dive into Deep Learning — 11.6 Self-Attention and Positional Encoding]]**

> Given a sequence of input tokens $\mathbf{x}_1, \ldots, \mathbf{x}_n$ where any $\mathbf{x}_i \in \mathbb{R}^d$ ($1 \leq i \leq n$), its self-attention outputs a sequence of the same length $\mathbf{y}_1, \ldots, \mathbf{y}_n$, where $$\mathbf{y}_i = f(\mathbf{x}_i, (\mathbf{x}_1, \mathbf{x}_1), \ldots, (\mathbf{x}_n, \mathbf{x}_n)) \in \mathbb{R}^d$$

### Step 6 · deep

Self-attention can also use added information about where each token appears in the sequence.

**Source receipt — [[Sources/d2l-self-attention|Dive into Deep Learning — 11.6 Self-Attention and Positional Encoding]]**

> we will discuss sequence encoding using self-attention, including using additional information for the sequence order.

## Source

Adapted from [[Sources/d2l-self-attention|Dive into Deep Learning — 11.6 Self-Attention and Positional Encoding]].

> Because every token is attending to each other token (unlike the case where decoder steps attend to encoder steps), such architectures are typically described as self-attention models , and elsewhere described as intra-attention model .

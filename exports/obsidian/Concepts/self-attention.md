---
title: "Self-Attention"
aliases:
  - "Self-Attention"
tags:
  - "concept"
  - "self-attention"
  - "sequence-modeling"
  - "tokens"
source: "[[Sources/d2l-self-attention]]"
prerequisites:
  - "[[Concepts/qkv]]"
license: "CC-BY-SA-4.0"
license_deed: "https://creativecommons.org/licenses/by-sa/4.0/"
modification_notice: "Adapted (translated to plain English; atomized into concept lessons) from Dive into Deep Learning — 11.6 Self-Attention and Positional Encoding by Aston Zhang, Zachary C. Lipton, Mu Li, and Alexander J. Smola, CC-BY-SA-4.0 (https://creativecommons.org/licenses/by-sa/4.0/)."
---

# Self-Attention

Self-attention lets every token attend to the other tokens in the same sequence.

## Prerequisites

- [[Concepts/qkv|Queries, Keys, and Values]]

## Lesson: How Tokens Look at One Another

### Step 1 · core

In self-attention, every token attends to every other token in the same sequence.

**Source receipt — [[Sources/d2l-self-attention|Dive into Deep Learning — 11.6 Self-Attention and Positional Encoding]]**

> Because every token is attending to each other token (unlike the case where decoder steps attend to encoder steps), such architectures are typically described as self-attention models , and elsewhere described as intra-attention model .

### Step 2 · core

Self-attention produces an output sequence with the same length as the input sequence.

**Source receipt — [[Sources/d2l-self-attention|Dive into Deep Learning — 11.6 Self-Attention and Positional Encoding]]**

> Given a sequence of input tokens $\mathbf{x}_1, \ldots, \mathbf{x}_n$ where any $\mathbf{x}_i \in \mathbb{R}^d$ ($1 \leq i \leq n$), its self-attention outputs a sequence of the same length $\mathbf{y}_1, \ldots, \mathbf{y}_n$

### Step 3 · deep

For each token, self-attention uses attention pooling over the tokens in the sequence.

**Source receipt — [[Sources/d2l-self-attention|Dive into Deep Learning — 11.6 Self-Attention and Positional Encoding]]**

> where $$\mathbf{y}_i = f(\mathbf{x}_i, (\mathbf{x}_1, \mathbf{x}_1), \ldots, (\mathbf{x}_n, \mathbf{x}_n)) \in \mathbb{R}^d$$ according to the definition of attention pooling in .

## Source

Adapted from [[Sources/d2l-self-attention|Dive into Deep Learning — 11.6 Self-Attention and Positional Encoding]].

> Because every token is attending to each other token (unlike the case where decoder steps attend to encoder steps), such architectures are typically described as self-attention models , and elsewhere described as intra-attention model .

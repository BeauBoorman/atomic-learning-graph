---
id: "self-attention"
title: "Self-Attention"
source: "d2l-self-attention"
source_title: "Dive into Deep Learning — 11.6 Self-Attention and Positional Encoding"
url: "https://github.com/d2l-ai/d2l-en/blob/b2e2ae30898a9d0126a9699ae7e441de3e272715/chapter_attention-mechanisms-and-transformers/self-attention-and-positional-encoding.md"
author: "Aston Zhang, Zachary C. Lipton, Mu Li, and Alexander J. Smola"
license: "CC-BY-SA-4.0"
license_deed: "https://creativecommons.org/licenses/by-sa/4.0/"
modification_notice: "Adapted (translated to plain English; atomized into concept lessons) from Dive into Deep Learning — 11.6 Self-Attention and Positional Encoding by Aston Zhang, Zachary C. Lipton, Mu Li, and Alexander J. Smola, CC-BY-SA-4.0 (https://creativecommons.org/licenses/by-sa/4.0/)."
tags:
  - "attention"
  - "self-attention"
  - "sequence-encoding"
  - "tokens"
---

# Self-Attention

Self-attention lets every token attend to every other token in the same sequence.

## Prerequisites

- [[qkv]]

## Lesson: How Tokens Look at One Another

### Step 1 · core

In self-attention, every token attends to every other token in the same sequence.

**Source receipt — `d2l-self-attention`**

> Because every token is attending to each other token (unlike the case where decoder steps attend to encoder steps), such architectures are typically described as self-attention models , and elsewhere described as intra-attention model .

### Step 2 · core

Self-attention produces an output sequence with the same length as the input sequence.

**Source receipt — `d2l-self-attention`**

> Given a sequence of input tokens $\mathbf{x}_1, \ldots, \mathbf{x}_n$ where any $\mathbf{x}_i \in \mathbb{R}^d$ ($1 \leq i \leq n$), its self-attention outputs a sequence of the same length $\mathbf{y}_1, \ldots, \mathbf{y}_n$

### Step 3 · deep

When computed with multi-head attention, the output data has the same shape as the input data.

**Source receipt — `d2l-self-attention`**

> Using multi-head attention, the following code snippet computes the self-attention of a tensor with shape (batch size, number of time steps or sequence length in tokens, $d$). The output tensor has the same shape.

## Source

Source: d2l-self-attention

URL: https://github.com/d2l-ai/d2l-en/blob/b2e2ae30898a9d0126a9699ae7e441de3e272715/chapter_attention-mechanisms-and-transformers/self-attention-and-positional-encoding.md

> Because every token is attending to each other token (unlike the case where decoder steps attend to encoder steps), such architectures are typically described as self-attention models , and elsewhere described as intra-attention model .

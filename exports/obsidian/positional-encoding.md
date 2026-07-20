---
id: "positional-encoding"
title: "Positional Encoding"
source: "d2l-self-attention"
source_title: "Dive into Deep Learning — 11.6 Self-Attention and Positional Encoding"
url: "https://github.com/d2l-ai/d2l-en/blob/b2e2ae30898a9d0126a9699ae7e441de3e272715/chapter_attention-mechanisms-and-transformers/self-attention-and-positional-encoding.md"
author: "Aston Zhang, Zachary C. Lipton, Mu Li, and Alexander J. Smola"
license: "CC-BY-SA-4.0"
license_deed: "https://creativecommons.org/licenses/by-sa/4.0/"
modification_notice: "Adapted (translated to plain English; atomized into concept lessons) from Dive into Deep Learning — 11.6 Self-Attention and Positional Encoding by Aston Zhang, Zachary C. Lipton, Mu Li, and Alexander J. Smola, CC-BY-SA-4.0 (https://creativecommons.org/licenses/by-sa/4.0/)."
tags:
  - "positional-encoding"
  - "self-attention"
  - "sequence-order"
---

# Positional Encoding

Positional encodings provide token-order information to models as additional token-associated inputs.

## Prerequisites

- [[self-attention]]

## Lesson: Adding Token Order Information

### Step 1 · core

The usual way to preserve token order is to give the model an extra input associated with each token.

**Source receipt — `d2l-self-attention`**

> The dominant approach for preserving information about the order of tokens is to represent this to the model as an additional input associated with each token.

### Step 2 · core

These extra inputs are called positional encodings, and they may be learned or set in advance.

**Source receipt — `d2l-self-attention`**

> These inputs are called positional encodings, and they can either be learned or fixed a priori.

### Step 3 · deep

One fixed positional encoding scheme uses sine and cosine functions.

**Source receipt — `d2l-self-attention`**

> We now describe a simple scheme for fixed positional encodings based on sine and cosine functions .

### Step 4 · deep

The positional encoding is added to the input representation using a positional embedding matrix of the same shape.

**Source receipt — `d2l-self-attention`**

> The positional encoding outputs $\mathbf{X} + \mathbf{P}$ using a positional embedding matrix $\mathbf{P} \in \mathbb{R}^{n \times d}$ of the same shape

## Source

Source: d2l-self-attention

URL: https://github.com/d2l-ai/d2l-en/blob/b2e2ae30898a9d0126a9699ae7e441de3e272715/chapter_attention-mechanisms-and-transformers/self-attention-and-positional-encoding.md

> The dominant approach for preserving information about the order of tokens is to represent this to the model as an additional input associated with each token.

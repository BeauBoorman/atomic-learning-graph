---
id: "positional-encoding"
title: "Positional Encoding"
source: "d2l-self-attention"
url: "https://github.com/d2l-ai/d2l-en/blob/b2e2ae30898a9d0126a9699ae7e441de3e272715/chapter_attention-mechanisms-and-transformers/self-attention-and-positional-encoding.md"
license: "CC-BY-SA-4.0"
tags:
  - "positional encoding"
  - "self-attention"
  - "sequence order"
---

Positional information is supplied as an additional token-associated input because self-attention alone does not preserve sequence order.

## Prerequisites

- [[self-attention]]

## Source

Source: d2l-self-attention

URL: https://github.com/d2l-ai/d2l-en/blob/b2e2ae30898a9d0126a9699ae7e441de3e272715/chapter_attention-mechanisms-and-transformers/self-attention-and-positional-encoding.md

> The dominant approach for preserving information about the order of tokens is to represent this to the model as an additional input associated with each token.

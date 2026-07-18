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
  - "positional encoding"
  - "self-attention"
  - "sequence order"
  - "token representations"
---

Positional encodings provide token-order information to models as additional token-associated inputs.

## Prerequisites

- [[self-attention]]

## Source

Source: d2l-self-attention

URL: https://github.com/d2l-ai/d2l-en/blob/b2e2ae30898a9d0126a9699ae7e441de3e272715/chapter_attention-mechanisms-and-transformers/self-attention-and-positional-encoding.md

> The dominant approach for preserving information about the order of tokens is to represent this to the model as an additional input associated with each token.

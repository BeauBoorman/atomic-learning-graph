---
id: "self-attention"
title: "Self-Attention"
source: "d2l-self-attention"
source_title: "Dive into Deep Learning — 11.6 Self-Attention and Positional Encoding"
url: "https://github.com/d2l-ai/d2l-en/blob/b2e2ae30898a9d0126a9699ae7e441de3e272715/chapter_attention-mechanisms-and-transformers/self-attention-and-positional-encoding.md"
author: "Aston Zhang, Zachary C. Lipton, Mu Li, and Alexander J. Smola"
license: "CC-BY-SA-4.0"
modification_notice: "Adapted (translated to plain English; atomized into concept lessons) from Dive into Deep Learning — 11.6 Self-Attention and Positional Encoding by Aston Zhang, Zachary C. Lipton, Mu Li, and Alexander J. Smola, CC-BY-SA-4.0."
tags:
  - "attention"
  - "self-attention"
  - "sequence encoding"
  - "tokens"
---

Self-attention lets every token attend to every other token in the same sequence.

## Prerequisites

- [[qkv]]

## Source

Source: d2l-self-attention

URL: https://github.com/d2l-ai/d2l-en/blob/b2e2ae30898a9d0126a9699ae7e441de3e272715/chapter_attention-mechanisms-and-transformers/self-attention-and-positional-encoding.md

> Because every token is attending to each other token (unlike the case where decoder steps attend to encoder steps), such architectures are typically described as self-attention models , and elsewhere described as intra-attention model .

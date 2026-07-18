---
id: "self-attention"
title: "Self-Attention"
source: "d2l-self-attention"
url: "https://github.com/d2l-ai/d2l-en/blob/b2e2ae30898a9d0126a9699ae7e441de3e272715/chapter_attention-mechanisms-and-transformers/self-attention-and-positional-encoding.md"
license: "CC-BY-SA-4.0"
tags:
  - "self-attention"
  - "sequence modeling"
  - "tokens"
---

Self-attention lets every token attend to every other token when constructing token representations.

## Prerequisites

- [[qkv]]

## Source

Source: d2l-self-attention

URL: https://github.com/d2l-ai/d2l-en/blob/b2e2ae30898a9d0126a9699ae7e441de3e272715/chapter_attention-mechanisms-and-transformers/self-attention-and-positional-encoding.md

> Because every token is attending to each other token (unlike the case where decoder steps attend to encoder steps), such architectures are typically described as self-attention models , and elsewhere described as intra-attention model .

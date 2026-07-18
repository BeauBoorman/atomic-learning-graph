---
id: "qkv"
title: "Queries, Keys, and Values"
source: "d2l-queries-keys-values"
source_title: "Dive into Deep Learning — 11.1 Queries, Keys, and Values"
url: "https://github.com/d2l-ai/d2l-en/blob/b2e2ae30898a9d0126a9699ae7e441de3e272715/chapter_attention-mechanisms-and-transformers/queries-keys-values.md"
author: "Aston Zhang, Zachary C. Lipton, Mu Li, and Alexander J. Smola"
license: "CC-BY-SA-4.0"
modification_notice: "Adapted (translated to plain English; atomized into concept lessons) from Dive into Deep Learning — 11.1 Queries, Keys, and Values by Aston Zhang, Zachary C. Lipton, Mu Li, and Alexander J. Smola, CC-BY-SA-4.0."
tags:
  - "attention"
  - "keys"
  - "queries"
  - "values"
---

Attention can be framed using a query applied to a collection of key–value pairs.

## Prerequisites

- [[softmax]]

## Source

Source: d2l-queries-keys-values

URL: https://github.com/d2l-ai/d2l-en/blob/b2e2ae30898a9d0126a9699ae7e441de3e272715/chapter_attention-mechanisms-and-transformers/queries-keys-values.md

> For now, simply consider the following: denote by $\mathcal{D} \stackrel{\textrm{def}}{=} \{(\mathbf{k}_1, \mathbf{v}_1), \ldots (\mathbf{k}_m, \mathbf{v}_m)\}$ a database of $m$ tuples of keys and values.

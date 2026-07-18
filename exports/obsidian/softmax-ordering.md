---
id: "softmax-ordering"
title: "Softmax Preserves Ordering"
source: "d2l-softmax-regression"
url: "https://github.com/d2l-ai/d2l-en/blob/b2e2ae30898a9d0126a9699ae7e441de3e272715/chapter_linear-classification/softmax-regression.md"
license: "CC-BY-SA-4.0"
tags:
  - "classification"
  - "ordering"
  - "softmax"
---

Softmax preserves the ordering of its inputs, so the largest input also identifies the highest-probability class.

## Prerequisites

- [[softmax]]

## Source

Source: d2l-softmax-regression

URL: https://github.com/d2l-ai/d2l-en/blob/b2e2ae30898a9d0126a9699ae7e441de3e272715/chapter_linear-classification/softmax-regression.md

> Moreover, because the softmax operation preserves the ordering among its arguments, we do not need to compute the softmax to determine which class has been assigned the highest probability.

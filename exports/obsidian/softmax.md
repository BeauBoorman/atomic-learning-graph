---
id: "softmax"
title: "Softmax"
source: "d2l-softmax-regression"
source_title: "Dive into Deep Learning — 4.1 Softmax Regression"
url: "https://github.com/d2l-ai/d2l-en/blob/b2e2ae30898a9d0126a9699ae7e441de3e272715/chapter_linear-classification/softmax-regression.md"
author: "Aston Zhang, Zachary C. Lipton, Mu Li, and Alexander J. Smola"
license: "CC-BY-SA-4.0"
license_deed: "https://creativecommons.org/licenses/by-sa/4.0/"
modification_notice: "Adapted (translated to plain English; atomized into concept lessons) from Dive into Deep Learning — 4.1 Softmax Regression by Aston Zhang, Zachary C. Lipton, Mu Li, and Alexander J. Smola, CC-BY-SA-4.0 (https://creativecommons.org/licenses/by-sa/4.0/)."
tags:
  - "classification"
  - "normalization"
  - "probabilities"
  - "softmax"
---

Softmax exponentiates scores and normalizes them into values that sum to one.

## Prerequisites

- [[dot-product]]

## Source

Source: d2l-softmax-regression

URL: https://github.com/d2l-ai/d2l-en/blob/b2e2ae30898a9d0126a9699ae7e441de3e272715/chapter_linear-classification/softmax-regression.md

> We can then transform these values so that they add up to $1$ by dividing each by their sum.

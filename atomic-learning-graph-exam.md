# Atomic Learning Graph — Practice Exam

Every answer in the key carries the verbatim source passage that grounds it. Questions follow prerequisite order, so earlier answers are fair to assume in later ones.

## Part A — Explain each concept

1. In your own words, explain **Vectors**.
2. In your own words, explain **Dot Product**.
3. In your own words, explain **Matrix–Vector Product**.
4. In your own words, explain **Softmax**.
5. In your own words, explain **Queries, Keys, and Values**.
6. In your own words, explain **Attention Pooling**.
7. In your own words, explain **Self-Attention**.
8. In your own words, explain **Positional Encoding**.
9. In your own words, explain **Softmax Preserves Ordering**.
10. In your own words, explain **Vector Norm**.

## Part B — Match each passage to the concept it grounds

Passages are listed in passage-text order, not exam order.

**P1** — from Dive into Deep Learning — 4.1 Softmax Regression (d2l-softmax-regression):

> As a side effect, we encountered the softmax, a convenient activation function that transforms outputs of an ordinary neural network layer into valid discrete probability distributions.

**P2** — from Dive into Deep Learning — 11.1 Queries, Keys, and Values (d2l-queries-keys-values):

> As such, the attention over generates a linear combination of values contained in the database.

**P3** — from Dive into Deep Learning — 11.6 Self-Attention and Positional Encoding (d2l-self-attention):

> Because every token is attending to each other token (unlike the case where decoder steps attend to encoder steps), such architectures are typically described as self-attention models , and elsewhere described as intra-attention model .

**P4** — from Dive into Deep Learning — 2.3 Linear Algebra (d2l-linear-algebra):

> For current purposes, you can think of a vector as a fixed-length array of scalars.

**P5** — from Dive into Deep Learning — 2.3 Linear Algebra (d2l-linear-algebra):

> Given two vectors , their dot product (also known as inner product, ) is a sum over the products of the elements at the same position: .

**P6** — from Dive into Deep Learning — 2.3 Linear Algebra (d2l-linear-algebra):

> Informally, the norm of a vector tells us how big it is.

**P7** — from Dive into Deep Learning — 4.1 Softmax Regression (d2l-softmax-regression):

> Moreover, because the softmax operation preserves the ordering among its arguments, we do not need to compute the softmax to determine which class has been assigned the highest probability.

**P8** — from Dive into Deep Learning — 11.1 Queries, Keys, and Values (d2l-queries-keys-values):

> The attention mechanism computes a linear combination over values via attention pooling, where weights are derived according to the compatibility between a query and keys .

**P9** — from Dive into Deep Learning — 11.6 Self-Attention and Positional Encoding (d2l-self-attention):

> The dominant approach for preserving information about the order of tokens is to represent this to the model as an additional input associated with each token.

**P10** — from Dive into Deep Learning — 2.3 Linear Algebra (d2l-linear-algebra):

> The matrix--vector product is simply a column vector of length m, whose element is the dot product : We can think of multiplication with a matrix as a transformation that projects vectors from to .

## Answer Key — Part A

### A1. Vectors

A vector is a fixed-length array whose elements are scalar values.

Source receipt:

> For current purposes, you can think of a vector as a fixed-length array of scalars.

Source ID: d2l-linear-algebra  
Title: Dive into Deep Learning — 2.3 Linear Algebra  
Author: Aston Zhang, Zachary C. Lipton, Mu Li, and Alexander J. Smola  
License: CC-BY-SA-4.0  
URL: https://github.com/d2l-ai/d2l-en/blob/b2e2ae30898a9d0126a9699ae7e441de3e272715/chapter_preliminaries/linear-algebra.md

### A2. Dot Product

The dot product sums products of corresponding elements from two vectors.

Source receipt:

> Given two vectors , their dot product (also known as inner product, ) is a sum over the products of the elements at the same position: .

Source ID: d2l-linear-algebra  
Title: Dive into Deep Learning — 2.3 Linear Algebra  
Author: Aston Zhang, Zachary C. Lipton, Mu Li, and Alexander J. Smola  
License: CC-BY-SA-4.0  
URL: https://github.com/d2l-ai/d2l-en/blob/b2e2ae30898a9d0126a9699ae7e441de3e272715/chapter_preliminaries/linear-algebra.md

### A3. Matrix–Vector Product

A matrix–vector product produces a vector whose entries are dot products between matrix rows and the input vector.

Source receipt:

> The matrix--vector product is simply a column vector of length m, whose element is the dot product : We can think of multiplication with a matrix as a transformation that projects vectors from to .

Source ID: d2l-linear-algebra  
Title: Dive into Deep Learning — 2.3 Linear Algebra  
Author: Aston Zhang, Zachary C. Lipton, Mu Li, and Alexander J. Smola  
License: CC-BY-SA-4.0  
URL: https://github.com/d2l-ai/d2l-en/blob/b2e2ae30898a9d0126a9699ae7e441de3e272715/chapter_preliminaries/linear-algebra.md

### A4. Softmax

Softmax transforms neural network outputs into a valid discrete probability distribution.

Source receipt:

> As a side effect, we encountered the softmax, a convenient activation function that transforms outputs of an ordinary neural network layer into valid discrete probability distributions.

Source ID: d2l-softmax-regression  
Title: Dive into Deep Learning — 4.1 Softmax Regression  
Author: Aston Zhang, Zachary C. Lipton, Mu Li, and Alexander J. Smola  
License: CC-BY-SA-4.0  
URL: https://github.com/d2l-ai/d2l-en/blob/b2e2ae30898a9d0126a9699ae7e441de3e272715/chapter_linear-classification/softmax-regression.md

### A5. Queries, Keys, and Values

An attention mechanism uses query–key compatibility to determine weights applied to values.

Source receipt:

> The attention mechanism computes a linear combination over values via attention pooling, where weights are derived according to the compatibility between a query and keys .

Source ID: d2l-queries-keys-values  
Title: Dive into Deep Learning — 11.1 Queries, Keys, and Values  
Author: Aston Zhang, Zachary C. Lipton, Mu Li, and Alexander J. Smola  
License: CC-BY-SA-4.0  
URL: https://github.com/d2l-ai/d2l-en/blob/b2e2ae30898a9d0126a9699ae7e441de3e272715/chapter_attention-mechanisms-and-transformers/queries-keys-values.md

### A6. Attention Pooling

Attention pooling forms a linear combination of stored values.

Source receipt:

> As such, the attention over generates a linear combination of values contained in the database.

Source ID: d2l-queries-keys-values  
Title: Dive into Deep Learning — 11.1 Queries, Keys, and Values  
Author: Aston Zhang, Zachary C. Lipton, Mu Li, and Alexander J. Smola  
License: CC-BY-SA-4.0  
URL: https://github.com/d2l-ai/d2l-en/blob/b2e2ae30898a9d0126a9699ae7e441de3e272715/chapter_attention-mechanisms-and-transformers/queries-keys-values.md

### A7. Self-Attention

Self-attention lets every token attend to every other token when constructing token representations.

Source receipt:

> Because every token is attending to each other token (unlike the case where decoder steps attend to encoder steps), such architectures are typically described as self-attention models , and elsewhere described as intra-attention model .

Source ID: d2l-self-attention  
Title: Dive into Deep Learning — 11.6 Self-Attention and Positional Encoding  
Author: Aston Zhang, Zachary C. Lipton, Mu Li, and Alexander J. Smola  
License: CC-BY-SA-4.0  
URL: https://github.com/d2l-ai/d2l-en/blob/b2e2ae30898a9d0126a9699ae7e441de3e272715/chapter_attention-mechanisms-and-transformers/self-attention-and-positional-encoding.md

### A8. Positional Encoding

Positional encodings provide token-order information to a model as additional token-associated inputs.

Source receipt:

> The dominant approach for preserving information about the order of tokens is to represent this to the model as an additional input associated with each token.

Source ID: d2l-self-attention  
Title: Dive into Deep Learning — 11.6 Self-Attention and Positional Encoding  
Author: Aston Zhang, Zachary C. Lipton, Mu Li, and Alexander J. Smola  
License: CC-BY-SA-4.0  
URL: https://github.com/d2l-ai/d2l-en/blob/b2e2ae30898a9d0126a9699ae7e441de3e272715/chapter_attention-mechanisms-and-transformers/self-attention-and-positional-encoding.md

### A9. Softmax Preserves Ordering

Softmax preserves the ordering of its inputs, so the largest input also identifies the highest-probability class.

Source receipt:

> Moreover, because the softmax operation preserves the ordering among its arguments, we do not need to compute the softmax to determine which class has been assigned the highest probability.

Source ID: d2l-softmax-regression  
Title: Dive into Deep Learning — 4.1 Softmax Regression  
Author: Aston Zhang, Zachary C. Lipton, Mu Li, and Alexander J. Smola  
License: CC-BY-SA-4.0  
URL: https://github.com/d2l-ai/d2l-en/blob/b2e2ae30898a9d0126a9699ae7e441de3e272715/chapter_linear-classification/softmax-regression.md

### A10. Vector Norm

A vector norm measures the magnitude or size of a vector.

Source receipt:

> Informally, the norm of a vector tells us how big it is.

Source ID: d2l-linear-algebra  
Title: Dive into Deep Learning — 2.3 Linear Algebra  
Author: Aston Zhang, Zachary C. Lipton, Mu Li, and Alexander J. Smola  
License: CC-BY-SA-4.0  
URL: https://github.com/d2l-ai/d2l-en/blob/b2e2ae30898a9d0126a9699ae7e441de3e272715/chapter_preliminaries/linear-algebra.md

## Answer Key — Part B

- P1 → Softmax (`softmax`)
- P2 → Attention Pooling (`attention-pooling`)
- P3 → Self-Attention (`self-attention`)
- P4 → Vectors (`vectors`)
- P5 → Dot Product (`dot-product`)
- P6 → Vector Norm (`vector-norm`)
- P7 → Softmax Preserves Ordering (`softmax-ordering`)
- P8 → Queries, Keys, and Values (`qkv`)
- P9 → Positional Encoding (`positional-encoding`)
- P10 → Matrix–Vector Product (`matrix-vector-product`)

## Source Attributions

### d2l-linear-algebra
- Title: Dive into Deep Learning — 2.3 Linear Algebra
- Author: Aston Zhang, Zachary C. Lipton, Mu Li, and Alexander J. Smola
- License: CC-BY-SA-4.0
- URL: https://github.com/d2l-ai/d2l-en/blob/b2e2ae30898a9d0126a9699ae7e441de3e272715/chapter_preliminaries/linear-algebra.md
- Modification notice: Adapted (translated to plain English; atomized into concept lessons; recast as practice-exam questions) from Dive into Deep Learning — 2.3 Linear Algebra by Aston Zhang, Zachary C. Lipton, Mu Li, and Alexander J. Smola, CC-BY-SA-4.0.

### d2l-queries-keys-values
- Title: Dive into Deep Learning — 11.1 Queries, Keys, and Values
- Author: Aston Zhang, Zachary C. Lipton, Mu Li, and Alexander J. Smola
- License: CC-BY-SA-4.0
- URL: https://github.com/d2l-ai/d2l-en/blob/b2e2ae30898a9d0126a9699ae7e441de3e272715/chapter_attention-mechanisms-and-transformers/queries-keys-values.md
- Modification notice: Adapted (translated to plain English; atomized into concept lessons; recast as practice-exam questions) from Dive into Deep Learning — 11.1 Queries, Keys, and Values by Aston Zhang, Zachary C. Lipton, Mu Li, and Alexander J. Smola, CC-BY-SA-4.0.

### d2l-self-attention
- Title: Dive into Deep Learning — 11.6 Self-Attention and Positional Encoding
- Author: Aston Zhang, Zachary C. Lipton, Mu Li, and Alexander J. Smola
- License: CC-BY-SA-4.0
- URL: https://github.com/d2l-ai/d2l-en/blob/b2e2ae30898a9d0126a9699ae7e441de3e272715/chapter_attention-mechanisms-and-transformers/self-attention-and-positional-encoding.md
- Modification notice: Adapted (translated to plain English; atomized into concept lessons; recast as practice-exam questions) from Dive into Deep Learning — 11.6 Self-Attention and Positional Encoding by Aston Zhang, Zachary C. Lipton, Mu Li, and Alexander J. Smola, CC-BY-SA-4.0.

### d2l-softmax-regression
- Title: Dive into Deep Learning — 4.1 Softmax Regression
- Author: Aston Zhang, Zachary C. Lipton, Mu Li, and Alexander J. Smola
- License: CC-BY-SA-4.0
- URL: https://github.com/d2l-ai/d2l-en/blob/b2e2ae30898a9d0126a9699ae7e441de3e272715/chapter_linear-classification/softmax-regression.md
- Modification notice: Adapted (translated to plain English; atomized into concept lessons; recast as practice-exam questions) from Dive into Deep Learning — 4.1 Softmax Regression by Aston Zhang, Zachary C. Lipton, Mu Li, and Alexander J. Smola, CC-BY-SA-4.0.

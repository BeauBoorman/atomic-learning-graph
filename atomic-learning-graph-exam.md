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

**P1** — from Dive into Deep Learning — 11.6 Self-Attention and Positional Encoding (d2l-self-attention):

> Because every token is attending to each other token (unlike the case where decoder steps attend to encoder steps), such architectures are typically described as self-attention models , and elsewhere described as intra-attention model .

**P2** — from Dive into Deep Learning — 2.3 Linear Algebra (d2l-linear-algebra):

> For current purposes, you can think of a vector as a fixed-length array of scalars.

**P3** — from Dive into Deep Learning — 11.1 Queries, Keys, and Values (d2l-queries-keys-values):

> For now, simply consider the following: denote by $\mathcal{D} \stackrel{\textrm{def}}{=} \{(\mathbf{k}_1, \mathbf{v}_1), \ldots (\mathbf{k}_m, \mathbf{v}_m)\}$ a database of $m$ tuples of keys and values.

**P4** — from Dive into Deep Learning — 2.3 Linear Algebra (d2l-linear-algebra):

> Given two vectors $\mathbf{x}, \mathbf{y} \in \mathbb{R}^d$, their dot product $\mathbf{x}^\top \mathbf{y}$ (also known as inner product, $\langle \mathbf{x}, \mathbf{y}  \rangle$) is a sum over the products of the elements at the same position: $\mathbf{x}^\top \mathbf{y} = \sum_{i=1}^{d} x_i y_i$.

**P5** — from Dive into Deep Learning — 2.3 Linear Algebra (d2l-linear-algebra):

> Informally, the norm of a vector tells us how big it is.

**P6** — from Dive into Deep Learning — 4.1 Softmax Regression (d2l-softmax-regression):

> Moreover, because the softmax operation preserves the ordering among its arguments, we do not need to compute the softmax to determine which class has been assigned the highest probability.

**P7** — from Dive into Deep Learning — 11.1 Queries, Keys, and Values (d2l-queries-keys-values):

> The attention mechanism computes a linear combination over values $\mathbf{v}_\mathit{i}$ via attention pooling, where weights are derived according to the compatibility between a query $\mathbf{q}$ and keys $\mathbf{k}_\mathit{i}$.

**P8** — from Dive into Deep Learning — 11.6 Self-Attention and Positional Encoding (d2l-self-attention):

> The dominant approach for preserving information about the order of tokens is to represent this to the model as an additional input associated with each token.

**P9** — from Dive into Deep Learning — 2.3 Linear Algebra (d2l-linear-algebra):

> The matrix--vector product $\mathbf{A}\mathbf{x}$ is simply a column vector of length $m$, whose $i^\textrm{th}$ element is the dot product $\mathbf{a}^\top_i \mathbf{x}$: $$
> \mathbf{A}\mathbf{x}
> = \begin{bmatrix}
> \mathbf{a}^\top_{1} \\
> \mathbf{a}^\top_{2} \\
> \vdots \\
> \mathbf{a}^\top_m \\
> \end{bmatrix}\mathbf{x}
> = \begin{bmatrix}
>  \mathbf{a}^\top_{1} \mathbf{x}  \\
>  \mathbf{a}^\top_{2} \mathbf{x} \\
> \vdots\\
>  \mathbf{a}^\top_{m} \mathbf{x}\\
> \end{bmatrix}.
> $$

**P10** — from Dive into Deep Learning — 4.1 Softmax Regression (d2l-softmax-regression):

> We can then transform these values so that they add up to $1$ by dividing each by their sum.

## Answer Key — Part A

### A1. Vectors

A vector is a fixed-length array whose elements are scalars.

Source receipt:

> For current purposes, you can think of a vector as a fixed-length array of scalars.

Source ID: d2l-linear-algebra  
Title: Dive into Deep Learning — 2.3 Linear Algebra  
Author: Aston Zhang, Zachary C. Lipton, Mu Li, and Alexander J. Smola  
License: CC-BY-SA-4.0  
URL: https://github.com/d2l-ai/d2l-en/blob/b2e2ae30898a9d0126a9699ae7e441de3e272715/chapter_preliminaries/linear-algebra.md

### A2. Dot Product

The dot product of two vectors sums the products of elements at corresponding positions.

Source receipt:

> Given two vectors $\mathbf{x}, \mathbf{y} \in \mathbb{R}^d$, their dot product $\mathbf{x}^\top \mathbf{y}$ (also known as inner product, $\langle \mathbf{x}, \mathbf{y}  \rangle$) is a sum over the products of the elements at the same position: $\mathbf{x}^\top \mathbf{y} = \sum_{i=1}^{d} x_i y_i$.

Source ID: d2l-linear-algebra  
Title: Dive into Deep Learning — 2.3 Linear Algebra  
Author: Aston Zhang, Zachary C. Lipton, Mu Li, and Alexander J. Smola  
License: CC-BY-SA-4.0  
URL: https://github.com/d2l-ai/d2l-en/blob/b2e2ae30898a9d0126a9699ae7e441de3e272715/chapter_preliminaries/linear-algebra.md

### A3. Matrix–Vector Product

A matrix–vector product contains one dot product between the input vector and each row of the matrix.

Source receipt:

> The matrix--vector product $\mathbf{A}\mathbf{x}$ is simply a column vector of length $m$, whose $i^\textrm{th}$ element is the dot product $\mathbf{a}^\top_i \mathbf{x}$: $$
> \mathbf{A}\mathbf{x}
> = \begin{bmatrix}
> \mathbf{a}^\top_{1} \\
> \mathbf{a}^\top_{2} \\
> \vdots \\
> \mathbf{a}^\top_m \\
> \end{bmatrix}\mathbf{x}
> = \begin{bmatrix}
>  \mathbf{a}^\top_{1} \mathbf{x}  \\
>  \mathbf{a}^\top_{2} \mathbf{x} \\
> \vdots\\
>  \mathbf{a}^\top_{m} \mathbf{x}\\
> \end{bmatrix}.
> $$

Source ID: d2l-linear-algebra  
Title: Dive into Deep Learning — 2.3 Linear Algebra  
Author: Aston Zhang, Zachary C. Lipton, Mu Li, and Alexander J. Smola  
License: CC-BY-SA-4.0  
URL: https://github.com/d2l-ai/d2l-en/blob/b2e2ae30898a9d0126a9699ae7e441de3e272715/chapter_preliminaries/linear-algebra.md

### A4. Softmax

Softmax exponentiates scores and normalizes them into values that sum to one.

Source receipt:

> We can then transform these values so that they add up to $1$ by dividing each by their sum.

Source ID: d2l-softmax-regression  
Title: Dive into Deep Learning — 4.1 Softmax Regression  
Author: Aston Zhang, Zachary C. Lipton, Mu Li, and Alexander J. Smola  
License: CC-BY-SA-4.0  
URL: https://github.com/d2l-ai/d2l-en/blob/b2e2ae30898a9d0126a9699ae7e441de3e272715/chapter_linear-classification/softmax-regression.md

### A5. Queries, Keys, and Values

Attention can be framed using a query applied to a collection of key–value pairs.

Source receipt:

> For now, simply consider the following: denote by $\mathcal{D} \stackrel{\textrm{def}}{=} \{(\mathbf{k}_1, \mathbf{v}_1), \ldots (\mathbf{k}_m, \mathbf{v}_m)\}$ a database of $m$ tuples of keys and values.

Source ID: d2l-queries-keys-values  
Title: Dive into Deep Learning — 11.1 Queries, Keys, and Values  
Author: Aston Zhang, Zachary C. Lipton, Mu Li, and Alexander J. Smola  
License: CC-BY-SA-4.0  
URL: https://github.com/d2l-ai/d2l-en/blob/b2e2ae30898a9d0126a9699ae7e441de3e272715/chapter_attention-mechanisms-and-transformers/queries-keys-values.md

### A6. Attention Pooling

Attention pooling combines values linearly using weights determined by query–key compatibility.

Source receipt:

> The attention mechanism computes a linear combination over values $\mathbf{v}_\mathit{i}$ via attention pooling, where weights are derived according to the compatibility between a query $\mathbf{q}$ and keys $\mathbf{k}_\mathit{i}$.

Source ID: d2l-queries-keys-values  
Title: Dive into Deep Learning — 11.1 Queries, Keys, and Values  
Author: Aston Zhang, Zachary C. Lipton, Mu Li, and Alexander J. Smola  
License: CC-BY-SA-4.0  
URL: https://github.com/d2l-ai/d2l-en/blob/b2e2ae30898a9d0126a9699ae7e441de3e272715/chapter_attention-mechanisms-and-transformers/queries-keys-values.md

### A7. Self-Attention

Self-attention lets every token attend to every other token in the same sequence.

Source receipt:

> Because every token is attending to each other token (unlike the case where decoder steps attend to encoder steps), such architectures are typically described as self-attention models , and elsewhere described as intra-attention model .

Source ID: d2l-self-attention  
Title: Dive into Deep Learning — 11.6 Self-Attention and Positional Encoding  
Author: Aston Zhang, Zachary C. Lipton, Mu Li, and Alexander J. Smola  
License: CC-BY-SA-4.0  
URL: https://github.com/d2l-ai/d2l-en/blob/b2e2ae30898a9d0126a9699ae7e441de3e272715/chapter_attention-mechanisms-and-transformers/self-attention-and-positional-encoding.md

### A8. Positional Encoding

Positional encodings provide token-order information to models as additional token-associated inputs.

Source receipt:

> The dominant approach for preserving information about the order of tokens is to represent this to the model as an additional input associated with each token.

Source ID: d2l-self-attention  
Title: Dive into Deep Learning — 11.6 Self-Attention and Positional Encoding  
Author: Aston Zhang, Zachary C. Lipton, Mu Li, and Alexander J. Smola  
License: CC-BY-SA-4.0  
URL: https://github.com/d2l-ai/d2l-en/blob/b2e2ae30898a9d0126a9699ae7e441de3e272715/chapter_attention-mechanisms-and-transformers/self-attention-and-positional-encoding.md

### A9. Softmax Preserves Ordering

Softmax preserves score ordering, so the largest input score identifies the class with the highest output probability.

Source receipt:

> Moreover, because the softmax operation preserves the ordering among its arguments, we do not need to compute the softmax to determine which class has been assigned the highest probability.

Source ID: d2l-softmax-regression  
Title: Dive into Deep Learning — 4.1 Softmax Regression  
Author: Aston Zhang, Zachary C. Lipton, Mu Li, and Alexander J. Smola  
License: CC-BY-SA-4.0  
URL: https://github.com/d2l-ai/d2l-en/blob/b2e2ae30898a9d0126a9699ae7e441de3e272715/chapter_linear-classification/softmax-regression.md

### A10. Vector Norm

A vector norm provides a scalar measure of the vector's magnitude.

Source receipt:

> Informally, the norm of a vector tells us how big it is.

Source ID: d2l-linear-algebra  
Title: Dive into Deep Learning — 2.3 Linear Algebra  
Author: Aston Zhang, Zachary C. Lipton, Mu Li, and Alexander J. Smola  
License: CC-BY-SA-4.0  
URL: https://github.com/d2l-ai/d2l-en/blob/b2e2ae30898a9d0126a9699ae7e441de3e272715/chapter_preliminaries/linear-algebra.md

## Answer Key — Part B

- P1 → Self-Attention (`self-attention`)
- P2 → Vectors (`vectors`)
- P3 → Queries, Keys, and Values (`qkv`)
- P4 → Dot Product (`dot-product`)
- P5 → Vector Norm (`vector-norm`)
- P6 → Softmax Preserves Ordering (`softmax-ordering`)
- P7 → Attention Pooling (`attention-pooling`)
- P8 → Positional Encoding (`positional-encoding`)
- P9 → Matrix–Vector Product (`matrix-vector-product`)
- P10 → Softmax (`softmax`)

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

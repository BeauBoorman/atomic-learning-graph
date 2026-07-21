# Atomic Learning Graph — Practice Exam

This is a printable self-check: open it in any Markdown reader, answer Parts A and B without looking ahead, then compare your work with the answer key.

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

**P1** — from Dive into Deep Learning — 11.1 Queries, Keys, and Values (d2l-queries-keys-values):

> As such, the attention over $\mathcal{D}$ generates a linear combination of values contained in the database.

**P2** — from Dive into Deep Learning — 11.6 Self-Attention and Positional Encoding (d2l-self-attention):

> Because every token is attending to each other token (unlike the case where decoder steps attend to encoder steps), such architectures are typically described as self-attention models , and elsewhere described as intra-attention model .

**P3** — from Dive into Deep Learning — 2.3 Linear Algebra (d2l-linear-algebra):

> For current purposes, you can think of a vector as a fixed-length array of scalars.

**P4** — from Dive into Deep Learning — 2.3 Linear Algebra (d2l-linear-algebra):

> Given two vectors $\mathbf{x}, \mathbf{y} \in \mathbb{R}^d$, their dot product $\mathbf{x}^\top \mathbf{y}$ (also known as inner product, $\langle \mathbf{x}, \mathbf{y}  \rangle$) is a sum over the products of the elements at the same position: $\mathbf{x}^\top \mathbf{y} = \sum_{i=1}^{d} x_i y_i$.

**P5** — from Dive into Deep Learning — 2.3 Linear Algebra (d2l-linear-algebra):

> Informally, the norm of a vector tells us how big it is.

**P6** — from Dive into Deep Learning — 4.1 Softmax Regression (d2l-softmax-regression):

> Moreover, because the softmax operation preserves the ordering among its arguments, we do not need to compute the softmax to determine which class has been assigned the highest probability.

**P7** — from Dive into Deep Learning — 4.1 Softmax Regression (d2l-softmax-regression):

> Putting these two pieces together gives us the softmax function: $$\hat{\mathbf{y}} = \mathrm{softmax}(\mathbf{o}) \quad \textrm{where}\quad \hat{y}_i = \frac{\exp(o_i)}{\sum_j \exp(o_j)}.$$

**P8** — from Dive into Deep Learning — 11.1 Queries, Keys, and Values (d2l-queries-keys-values):

> The attention mechanism computes a linear combination over values $\mathbf{v}_\mathit{i}$ via attention pooling, where weights are derived according to the compatibility between a query $\mathbf{q}$ and keys $\mathbf{k}_\mathit{i}$.

**P9** — from Dive into Deep Learning — 11.6 Self-Attention and Positional Encoding (d2l-self-attention):

> The dominant approach for preserving information about the order of tokens is to represent this to the model as an additional input associated with each token.

**P10** — from Dive into Deep Learning — 2.3 Linear Algebra (d2l-linear-algebra):

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

## Answer Key — Part A

### A1. Vectors

A vector is a fixed-length array whose elements are scalars.

Source receipt:

> When vectors represent examples from real-world datasets, their values hold some real-world significance.

Source ID: d2l-linear-algebra  
Title: Dive into Deep Learning — 2.3 Linear Algebra  
Author: Aston Zhang, Zachary C. Lipton, Mu Li, and Alexander J. Smola  
License: CC-BY-SA-4.0 (https://creativecommons.org/licenses/by-sa/4.0/)  
URL: https://github.com/d2l-ai/d2l-en/blob/b2e2ae30898a9d0126a9699ae7e441de3e272715/chapter_preliminaries/linear-algebra.md

#### Recall rubric

A self-check passes an item only when every listed source-derived term appears in the answer.

- Item 1 must mention: `vectors`, `represent`, `examples`, `real-world`, `datasets`, `values`, `hold`, `significance`
  Verbatim source span (`d2l-linear-algebra`):

> When vectors represent examples from real-world datasets, their values hold some real-world significance.

- Item 2 must mention: `vector`, `fixed-length`, `array`, `scalars`
  Verbatim source span (`d2l-linear-algebra`):

> For current purposes, you can think of a vector as a fixed-length array of scalars.

- Item 3 must mention: `example`, `denotes`, `element`
  Verbatim source span (`d2l-linear-algebra`):

> For example, $x_2$ denotes the second element of $\mathbf{x}$.

- Item 4 must mention: `example`, `training`, `model`, `predict`, `risk`, `loan`, `defaulting`, `associate`, `applicant`, `vector`, `whose`, `components`, `correspond`, `quantities`, `income`, `length`, `employment`, `number`, `previous`, `defaults`
  Verbatim source span (`d2l-linear-algebra`):

> For example, if we were training a model to predict the risk of a loan defaulting, we might associate each applicant with a vector whose components correspond to quantities like their income, length of employment, or number of previous defaults.

- Item 5 must mention: `elements`, `vector`
  Verbatim source span (`d2l-linear-algebra`):

> Here $x_1, \ldots, x_n$ are elements of the vector.

### A2. Dot Product

The dot product sums the products of corresponding elements in two vectors.

Source receipt:

> Dot products are useful in a wide range of contexts.

Source ID: d2l-linear-algebra  
Title: Dive into Deep Learning — 2.3 Linear Algebra  
Author: Aston Zhang, Zachary C. Lipton, Mu Li, and Alexander J. Smola  
License: CC-BY-SA-4.0 (https://creativecommons.org/licenses/by-sa/4.0/)  
URL: https://github.com/d2l-ai/d2l-en/blob/b2e2ae30898a9d0126a9699ae7e441de3e272715/chapter_preliminaries/linear-algebra.md

#### Recall rubric

A self-check passes an item only when every listed source-derived term appears in the answer.

- Item 1 must mention: `dot`, `products`, `useful`, `wide`, `range`, `contexts`
  Verbatim source span (`d2l-linear-algebra`):

> Dot products are useful in a wide range of contexts.

- Item 2 must mention: `dot`, `product`, `two`, `vectors`, `sum`, `products`, `elements`, `position`
  Verbatim source span (`d2l-linear-algebra`):

> The dot product of two vectors is a sum over the products of the elements at the same position

- Item 3 must mention: `calculate`, `dot`, `product`, `two`, `vectors`, `performing`, `elementwise`, `multiplication`, `followed`, `sum`
  Verbatim source span (`d2l-linear-algebra`):

> we can calculate the dot product of two vectors by performing an elementwise multiplication followed by a sum

- Item 4 must mention: `weighted`, `sum`, `values`, `according`, `weights`, `expressed`, `dot`, `product`
  Verbatim source span (`d2l-linear-algebra`):

> the weighted sum of the values in $\mathbf{x}$ according to the weights $\mathbf{w}$ could be expressed as the dot product $\mathbf{x}^\top \mathbf{w}$.

- Item 5 must mention: `two`, `vectors`, `dot`, `product`, `known`, `inner`, `sum`, `products`, `elements`, `position`
  Verbatim source span (`d2l-linear-algebra`):

> Given two vectors $\mathbf{x}, \mathbf{y} \in \mathbb{R}^d$, their dot product $\mathbf{x}^\top \mathbf{y}$ (also known as inner product, $\langle \mathbf{x}, \mathbf{y}  \rangle$) is a sum over the products of the elements at the same position: $\mathbf{x}^\top \mathbf{y} = \sum_{i=1}^{d} x_i y_i$.

- Item 6 must mention: `matrix`, `vector`, `product`, `simply`, `column`, `length`, `whose`, `element`, `dot`
  Verbatim source span (`d2l-linear-algebra`):

> The matrix--vector product $\mathbf{A}\mathbf{x}$ is simply a column vector of length $m$, whose $i^\textrm{th}$ element is the dot product $\mathbf{a}^\top_i \mathbf{x}$

### A3. Matrix–Vector Product

A matrix–vector product produces a vector whose elements are dot products between matrix rows and the input vector.

Source receipt:

> We can think of multiplication with a matrix $\mathbf{A}\in \mathbb{R}^{m \times n}$ as a transformation that projects vectors from $\mathbb{R}^{n}$ to $\mathbb{R}^{m}$.

Source ID: d2l-linear-algebra  
Title: Dive into Deep Learning — 2.3 Linear Algebra  
Author: Aston Zhang, Zachary C. Lipton, Mu Li, and Alexander J. Smola  
License: CC-BY-SA-4.0 (https://creativecommons.org/licenses/by-sa/4.0/)  
URL: https://github.com/d2l-ai/d2l-en/blob/b2e2ae30898a9d0126a9699ae7e441de3e272715/chapter_preliminaries/linear-algebra.md

#### Recall rubric

A self-check passes an item only when every listed source-derived term appears in the answer.

- Item 1 must mention: `multiplication`, `matrix`, `transformation`, `projects`, `vectors`
  Verbatim source span (`d2l-linear-algebra`):

> We can think of multiplication with a matrix $\mathbf{A}\in \mathbb{R}^{m \times n}$ as a transformation that projects vectors from $\mathbb{R}^{n}$ to $\mathbb{R}^{m}$.

- Item 2 must mention: `matrix`, `vector`, `product`, `simply`, `column`, `length`, `whose`, `element`, `dot`
  Verbatim source span (`d2l-linear-algebra`):

> The matrix--vector product $\mathbf{A}\mathbf{x}$ is simply a column vector of length $m$, whose $i^\textrm{th}$ element is the dot product $\mathbf{a}^\top_i \mathbf{x}$

- Item 3 must mention: `matrix`, `vector`, `product`, `simply`, `column`, `length`, `whose`, `element`, `dot`
  Verbatim source span (`d2l-linear-algebra`):

> The matrix--vector product $\mathbf{A}\mathbf{x}$ is simply a column vector of length $m$, whose $i^\textrm{th}$ element is the dot product $\mathbf{a}^\top_i \mathbf{x}$

- Item 4 must mention: `whose`, `element`, `dot`, `product`
  Verbatim source span (`d2l-linear-algebra`):

> whose $i^\textrm{th}$ element is the dot product $\mathbf{a}^\top_i \mathbf{x}$

- Item 5 must mention: `matrix`, `vector`, `product`, `simply`, `column`, `length`, `whose`, `element`, `dot`
  Verbatim source span (`d2l-linear-algebra`):

> The matrix--vector product $\mathbf{A}\mathbf{x}$ is simply a column vector of length $m$, whose $i^\textrm{th}$ element is the dot product $\mathbf{a}^\top_i \mathbf{x}$

### A4. Softmax

Softmax converts model outputs into a normalized probability distribution by exponentiating and dividing by the sum.

Source receipt:

> Putting these two pieces together gives us the softmax function: $$\hat{\mathbf{y}} = \mathrm{softmax}(\mathbf{o}) \quad \textrm{where}\quad \hat{y}_i = \frac{\exp(o_i)}{\sum_j \exp(o_j)}.$$

Source ID: d2l-softmax-regression  
Title: Dive into Deep Learning — 4.1 Softmax Regression  
Author: Aston Zhang, Zachary C. Lipton, Mu Li, and Alexander J. Smola  
License: CC-BY-SA-4.0 (https://creativecommons.org/licenses/by-sa/4.0/)  
URL: https://github.com/d2l-ai/d2l-en/blob/b2e2ae30898a9d0126a9699ae7e441de3e272715/chapter_linear-classification/softmax-regression.md

#### Recall rubric

A self-check passes an item only when every listed source-derived term appears in the answer.

- Item 1 must mention: `putting`, `two`, `pieces`, `gives`, `softmax`, `function`
  Verbatim source span (`d2l-softmax-regression`):

> Putting these two pieces together gives us the softmax function: $$\hat{\mathbf{y}} = \mathrm{softmax}(\mathbf{o}) \quad \textrm{where}\quad \hat{y}_i = \frac{\exp(o_i)}{\sum_j \exp(o_j)}.$$

- Item 2 must mention: 
  Verbatim source span (`d2l-softmax-regression`):

> \hat{y}_i = \frac{\exp(o_i)}{\sum_j \exp(o_j)}

- Item 3 must mention: 
  Verbatim source span (`d2l-softmax-regression`):

> \hat{y}_i = \frac{\exp(o_i)}{\sum_j \exp(o_j)}

- Item 4 must mention: 
  Verbatim source span (`d2l-softmax-regression`):

> \hat{y}_i = \frac{\exp(o_i)}{\sum_j \exp(o_j)}

- Item 5 must mention: `putting`, `two`, `pieces`, `gives`, `softmax`, `function`
  Verbatim source span (`d2l-softmax-regression`):

> Putting these two pieces together gives us the softmax function: $$\hat{\mathbf{y}} = \mathrm{softmax}(\mathbf{o}) \quad \textrm{where}\quad \hat{y}_i = \frac{\exp(o_i)}{\sum_j \exp(o_j)}.$$

### A5. Queries, Keys, and Values

Attention uses a query to determine compatibility with keys associated with stored values.

Source receipt:

> the actual "code" for executing on the set of keys and values, namely the query, can be quite concise, even though the space to operate on is significant.

Source ID: d2l-queries-keys-values  
Title: Dive into Deep Learning — 11.1 Queries, Keys, and Values  
Author: Aston Zhang, Zachary C. Lipton, Mu Li, and Alexander J. Smola  
License: CC-BY-SA-4.0 (https://creativecommons.org/licenses/by-sa/4.0/)  
URL: https://github.com/d2l-ai/d2l-en/blob/b2e2ae30898a9d0126a9699ae7e441de3e272715/chapter_attention-mechanisms-and-transformers/queries-keys-values.md

#### Recall rubric

A self-check passes an item only when every listed source-derived term appears in the answer.

- Item 1 must mention: `actual`, `code`, `executing`, `set`, `keys`, `values`, `namely`, `query`, `quite`, `concise`, `though`, `space`, `operate`, `significant`
  Verbatim source span (`d2l-queries-keys-values`):

> the actual "code" for executing on the set of keys and values, namely the query, can be quite concise, even though the space to operate on is significant.

- Item 2 must mention: `attention`, `mechanism`, `computes`, `linear`, `combination`, `values`, `pooling`, `weights`, `derived`, `according`, `compatibility`, `query`, `keys`
  Verbatim source span (`d2l-queries-keys-values`):

> The attention mechanism computes a linear combination over values $\mathbf{v}_\mathit{i}$ via attention pooling, where weights are derived according to the compatibility between a query $\mathbf{q}$ and keys $\mathbf{k}_\mathit{i}$.

- Item 3 must mention: `attention`, `mechanism`, `computes`, `linear`, `combination`, `values`, `pooling`, `weights`, `derived`, `according`, `compatibility`, `query`, `keys`
  Verbatim source span (`d2l-queries-keys-values`):

> The attention mechanism computes a linear combination over values $\mathbf{v}_\mathit{i}$ via attention pooling, where weights are derived according to the compatibility between a query $\mathbf{q}$ and keys $\mathbf{k}_\mathit{i}$.

- Item 4 must mention: `case`, `interpret`, `large`, `weights`, `way`, `model`, `select`, `components`, `relevance`
  Verbatim source span (`d2l-queries-keys-values`):

> In this case we might interpret large weights as a way for the model to select components of relevance.

- Item 5 must mention: `attention`, `mechanism`, `computes`, `linear`, `combination`, `values`, `pooling`, `weights`, `derived`, `according`, `compatibility`, `query`, `keys`
  Verbatim source span (`d2l-queries-keys-values`):

> The attention mechanism computes a linear combination over values $\mathbf{v}_\mathit{i}$ via attention pooling, where weights are derived according to the compatibility between a query $\mathbf{q}$ and keys $\mathbf{k}_\mathit{i}$.

### A6. Attention Pooling

Attention pooling generates a linear combination of values in a key–value database.

Source receipt:

> As such, the attention over $\mathcal{D}$ generates a linear combination of values contained in the database.

Source ID: d2l-queries-keys-values  
Title: Dive into Deep Learning — 11.1 Queries, Keys, and Values  
Author: Aston Zhang, Zachary C. Lipton, Mu Li, and Alexander J. Smola  
License: CC-BY-SA-4.0 (https://creativecommons.org/licenses/by-sa/4.0/)  
URL: https://github.com/d2l-ai/d2l-en/blob/b2e2ae30898a9d0126a9699ae7e441de3e272715/chapter_attention-mechanisms-and-transformers/queries-keys-values.md

#### Recall rubric

A self-check passes an item only when every listed source-derived term appears in the answer.

- Item 1 must mention: `attention`, `generates`, `linear`, `combination`, `values`, `contained`, `database`
  Verbatim source span (`d2l-queries-keys-values`):

> As such, the attention over $\mathcal{D}$ generates a linear combination of values contained in the database.

- Item 2 must mention: `attention`, `generates`, `linear`, `combination`, `values`, `contained`, `database`
  Verbatim source span (`d2l-queries-keys-values`):

> As such, the attention over $\mathcal{D}$ generates a linear combination of values contained in the database.

- Item 3 must mention: `attention`, `generates`, `linear`, `combination`, `values`, `contained`, `database`
  Verbatim source span (`d2l-queries-keys-values`):

> As such, the attention over $\mathcal{D}$ generates a linear combination of values contained in the database.

- Item 4 must mention: `weights`, `equal`, `amounts`, `averaging`, `across`, `entire`, `database`, `called`, `average`, `pooling`, `deep`, `learning`
  Verbatim source span (`d2l-queries-keys-values`):

> All weights are equal, i.e., $\alpha(\mathbf{q}, \mathbf{k}_i) = \frac{1}{m}$ for all $i$. This amounts to averaging across the entire database, also called average pooling in deep learning.

- Item 5 must mention: `weights`, `form`, `convex`, `combination`, `common`, `setting`, `deep`, `learning`
  Verbatim source span (`d2l-queries-keys-values`):

> The weights $\alpha(\mathbf{q}, \mathbf{k}_i)$ form a convex combination, i.e., $\sum_i \alpha(\mathbf{q}, \mathbf{k}_i) = 1$ and $\alpha(\mathbf{q}, \mathbf{k}_i) \geq 0$ for all $i$. This is the most common setting in deep learning.

### A7. Self-Attention

Self-attention lets every token attend to every other token in the same sequence.

Source receipt:

> Because every token is attending to each other token

Source ID: d2l-self-attention  
Title: Dive into Deep Learning — 11.6 Self-Attention and Positional Encoding  
Author: Aston Zhang, Zachary C. Lipton, Mu Li, and Alexander J. Smola  
License: CC-BY-SA-4.0 (https://creativecommons.org/licenses/by-sa/4.0/)  
URL: https://github.com/d2l-ai/d2l-en/blob/b2e2ae30898a9d0126a9699ae7e441de3e272715/chapter_attention-mechanisms-and-transformers/self-attention-and-positional-encoding.md

#### Recall rubric

A self-check passes an item only when every listed source-derived term appears in the answer.

- Item 1 must mention: `token`, `attending`
  Verbatim source span (`d2l-self-attention`):

> Because every token is attending to each other token

- Item 2 must mention: `architectures`, `typically`, `described`, `self-attention`, `models`, `elsewhere`, `intra-attention`, `model`
  Verbatim source span (`d2l-self-attention`):

> such architectures are typically described as self-attention models , and elsewhere described as intra-attention model .

- Item 3 must mention: `self-attention`, `outputs`, `sequence`, `length`, `according`, `definition`, `attention`, `pooling`
  Verbatim source span (`d2l-self-attention`):

> its self-attention outputs a sequence of the same length $\mathbf{y}_1, \ldots, \mathbf{y}_n$, where $$\mathbf{y}_i = f(\mathbf{x}_i, (\mathbf{x}_1, \mathbf{x}_1), \ldots, (\mathbf{x}_n, \mathbf{x}_n)) \in \mathbb{R}^d$$ according to the definition of attention pooling in .

- Item 4 must mention: `token`, `attending`
  Verbatim source span (`d2l-self-attention`):

> every token is attending to each other token

- Item 5 must mention: `sequence`, `input`, `tokens`, `self-attention`, `outputs`, `length`
  Verbatim source span (`d2l-self-attention`):

> Given a sequence of input tokens $\mathbf{x}_1, \ldots, \mathbf{x}_n$ where any $\mathbf{x}_i \in \mathbb{R}^d$ ($1 \leq i \leq n$), its self-attention outputs a sequence of the same length $\mathbf{y}_1, \ldots, \mathbf{y}_n$, where $$\mathbf{y}_i = f(\mathbf{x}_i, (\mathbf{x}_1, \mathbf{x}_1), \ldots, (\mathbf{x}_n, \mathbf{x}_n)) \in \mathbb{R}^d$$

- Item 6 must mention: `discuss`, `sequence`, `encoding`, `using`, `self-attention`, `including`, `additional`, `information`, `order`
  Verbatim source span (`d2l-self-attention`):

> we will discuss sequence encoding using self-attention, including using additional information for the sequence order.

### A8. Positional Encoding

Positional encodings provide token-order information to models as additional token-associated inputs.

Source receipt:

> The dominant approach for preserving information about the order of tokens is to represent this to the model as an additional input associated with each token.

Source ID: d2l-self-attention  
Title: Dive into Deep Learning — 11.6 Self-Attention and Positional Encoding  
Author: Aston Zhang, Zachary C. Lipton, Mu Li, and Alexander J. Smola  
License: CC-BY-SA-4.0 (https://creativecommons.org/licenses/by-sa/4.0/)  
URL: https://github.com/d2l-ai/d2l-en/blob/b2e2ae30898a9d0126a9699ae7e441de3e272715/chapter_attention-mechanisms-and-transformers/self-attention-and-positional-encoding.md

#### Recall rubric

A self-check passes an item only when every listed source-derived term appears in the answer.

- Item 1 must mention: `dominant`, `approach`, `preserving`, `information`, `order`, `tokens`, `represent`, `model`, `additional`, `input`, `associated`, `token`
  Verbatim source span (`d2l-self-attention`):

> The dominant approach for preserving information about the order of tokens is to represent this to the model as an additional input associated with each token.

- Item 2 must mention: `inputs`, `called`, `positional`, `encodings`, `learned`, `fixed`, `priori`
  Verbatim source span (`d2l-self-attention`):

> These inputs are called positional encodings, and they can either be learned or fixed a priori.

- Item 3 must mention: `positional`, `encoding`, `outputs`
  Verbatim source span (`d2l-self-attention`):

> The positional encoding outputs $\mathbf{X} + \mathbf{P}$

- Item 4 must mention: `positional`, `embedding`, `matrix`, `rows`, `correspond`, `positions`, `within`, `sequence`, `columns`, `represent`, `different`, `encoding`, `dimensions`
  Verbatim source span (`d2l-self-attention`):

> In the positional embedding matrix $\mathbf{P}$, rows correspond to positions within a sequence and columns represent different positional encoding dimensions.

- Item 5 must mention: `positional`, `encoding`, `outputs`, `using`, `embedding`, `matrix`, `shape`
  Verbatim source span (`d2l-self-attention`):

> The positional encoding outputs $\mathbf{X} + \mathbf{P}$ using a positional embedding matrix $\mathbf{P} \in \mathbb{R}^{n \times d}$ of the same shape

### A9. Softmax Preserves Ordering

Softmax preserves the ordering of its inputs, so the largest input identifies the highest-probability class.

Source receipt:

> we do not need to compute the softmax to determine which class has been assigned the highest probability.

Source ID: d2l-softmax-regression  
Title: Dive into Deep Learning — 4.1 Softmax Regression  
Author: Aston Zhang, Zachary C. Lipton, Mu Li, and Alexander J. Smola  
License: CC-BY-SA-4.0 (https://creativecommons.org/licenses/by-sa/4.0/)  
URL: https://github.com/d2l-ai/d2l-en/blob/b2e2ae30898a9d0126a9699ae7e441de3e272715/chapter_linear-classification/softmax-regression.md

#### Recall rubric

A self-check passes an item only when every listed source-derived term appears in the answer.

- Item 1 must mention: `need`, `compute`, `softmax`, `determine`, `class`, `assigned`, `highest`, `probability`
  Verbatim source span (`d2l-softmax-regression`):

> we do not need to compute the softmax to determine which class has been assigned the highest probability.

- Item 2 must mention: `softmax`, `operation`, `preserves`, `ordering`, `arguments`
  Verbatim source span (`d2l-softmax-regression`):

> the softmax operation preserves the ordering among its arguments

- Item 3 must mention: `softmax`, `operation`, `preserves`, `ordering`, `arguments`, `need`, `compute`, `determine`, `class`, `assigned`, `highest`, `probability`
  Verbatim source span (`d2l-softmax-regression`):

> because the softmax operation preserves the ordering among its arguments, we do not need to compute the softmax to determine which class has been assigned the highest probability.

- Item 4 must mention: `softmax`, `operation`, `preserves`, `ordering`, `arguments`
  Verbatim source span (`d2l-softmax-regression`):

> the softmax operation preserves the ordering among its arguments

- Item 5 must mention: `thus`
  Verbatim source span (`d2l-softmax-regression`):

> Thus, $$
> \operatorname*{argmax}_j \hat y_j = \operatorname*{argmax}_j o_j.
> $$

### A10. Vector Norm

A vector norm measures the magnitude or size of a vector.

Source receipt:

> Informally, the norm of a vector tells us how big it is.

Source ID: d2l-linear-algebra  
Title: Dive into Deep Learning — 2.3 Linear Algebra  
Author: Aston Zhang, Zachary C. Lipton, Mu Li, and Alexander J. Smola  
License: CC-BY-SA-4.0 (https://creativecommons.org/licenses/by-sa/4.0/)  
URL: https://github.com/d2l-ai/d2l-en/blob/b2e2ae30898a9d0126a9699ae7e441de3e272715/chapter_preliminaries/linear-algebra.md

#### Recall rubric

A self-check passes an item only when every listed source-derived term appears in the answer.

- Item 1 must mention: `informally`, `norm`, `vector`, `tells`, `how`, `big`
  Verbatim source span (`d2l-linear-algebra`):

> Informally, the norm of a vector tells us how big it is.

- Item 2 must mention: `norm`, `function`, `maps`, `vector`, `scalar`
  Verbatim source span (`d2l-linear-algebra`):

> A norm is a function $\| \cdot \|$ that maps a vector to a scalar

- Item 3 must mention: `euclidean`, `norm`, `learned`, `elementary`, `school`, `geometry`, `calculating`, `hypotenuse`, `right`, `triangle`, `square`, `root`, `sum`, `squares`, `vector's`, `elements`
  Verbatim source span (`d2l-linear-algebra`):

> The Euclidean norm that we all learned in elementary school geometry when calculating the hypotenuse of a right triangle is the square root of the sum of squares of a vector's elements.

- Item 4 must mention: `instance`, `norm`, `measures`, `euclidean`, `length`, `vector`
  Verbatim source span (`d2l-linear-algebra`):

> For instance, the $\ell_2$ norm measures the (Euclidean) length of a vector.

- Item 5 must mention: `formally`, `called`, `norm`, `expressed`
  Verbatim source span (`d2l-linear-algebra`):

> Formally, this is called the $\ell_2$ norm and expressed as ($$\|\mathbf{x}\|_2 = \sqrt{\sum_{i=1}^n x_i^2}.$$)

## Answer Key — Part B

- P1 → Attention Pooling (`attention-pooling`)
- P2 → Self-Attention (`self-attention`)
- P3 → Vectors (`vectors`)
- P4 → Dot Product (`dot-product`)
- P5 → Vector Norm (`vector-norm`)
- P6 → Softmax Preserves Ordering (`softmax-ordering`)
- P7 → Softmax (`softmax`)
- P8 → Queries, Keys, and Values (`qkv`)
- P9 → Positional Encoding (`positional-encoding`)
- P10 → Matrix–Vector Product (`matrix-vector-product`)

## Source Attributions

### d2l-linear-algebra
- Title: Dive into Deep Learning — 2.3 Linear Algebra
- Author: Aston Zhang, Zachary C. Lipton, Mu Li, and Alexander J. Smola
- License: CC-BY-SA-4.0 (https://creativecommons.org/licenses/by-sa/4.0/)
- URL: https://github.com/d2l-ai/d2l-en/blob/b2e2ae30898a9d0126a9699ae7e441de3e272715/chapter_preliminaries/linear-algebra.md
- Modification notice: Adapted (translated to plain English; atomized into concept lessons; recast as practice-exam questions) from Dive into Deep Learning — 2.3 Linear Algebra by Aston Zhang, Zachary C. Lipton, Mu Li, and Alexander J. Smola, CC-BY-SA-4.0 (https://creativecommons.org/licenses/by-sa/4.0/).

### d2l-queries-keys-values
- Title: Dive into Deep Learning — 11.1 Queries, Keys, and Values
- Author: Aston Zhang, Zachary C. Lipton, Mu Li, and Alexander J. Smola
- License: CC-BY-SA-4.0 (https://creativecommons.org/licenses/by-sa/4.0/)
- URL: https://github.com/d2l-ai/d2l-en/blob/b2e2ae30898a9d0126a9699ae7e441de3e272715/chapter_attention-mechanisms-and-transformers/queries-keys-values.md
- Modification notice: Adapted (translated to plain English; atomized into concept lessons; recast as practice-exam questions) from Dive into Deep Learning — 11.1 Queries, Keys, and Values by Aston Zhang, Zachary C. Lipton, Mu Li, and Alexander J. Smola, CC-BY-SA-4.0 (https://creativecommons.org/licenses/by-sa/4.0/).

### d2l-self-attention
- Title: Dive into Deep Learning — 11.6 Self-Attention and Positional Encoding
- Author: Aston Zhang, Zachary C. Lipton, Mu Li, and Alexander J. Smola
- License: CC-BY-SA-4.0 (https://creativecommons.org/licenses/by-sa/4.0/)
- URL: https://github.com/d2l-ai/d2l-en/blob/b2e2ae30898a9d0126a9699ae7e441de3e272715/chapter_attention-mechanisms-and-transformers/self-attention-and-positional-encoding.md
- Modification notice: Adapted (translated to plain English; atomized into concept lessons; recast as practice-exam questions) from Dive into Deep Learning — 11.6 Self-Attention and Positional Encoding by Aston Zhang, Zachary C. Lipton, Mu Li, and Alexander J. Smola, CC-BY-SA-4.0 (https://creativecommons.org/licenses/by-sa/4.0/).

### d2l-softmax-regression
- Title: Dive into Deep Learning — 4.1 Softmax Regression
- Author: Aston Zhang, Zachary C. Lipton, Mu Li, and Alexander J. Smola
- License: CC-BY-SA-4.0 (https://creativecommons.org/licenses/by-sa/4.0/)
- URL: https://github.com/d2l-ai/d2l-en/blob/b2e2ae30898a9d0126a9699ae7e441de3e272715/chapter_linear-classification/softmax-regression.md
- Modification notice: Adapted (translated to plain English; atomized into concept lessons; recast as practice-exam questions) from Dive into Deep Learning — 4.1 Softmax Regression by Aston Zhang, Zachary C. Lipton, Mu Li, and Alexander J. Smola, CC-BY-SA-4.0 (https://creativecommons.org/licenses/by-sa/4.0/).

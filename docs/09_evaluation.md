# 9. Evaluation & MIT-BIH Benchmark

## The MIT-BIH Arrhythmia Database
[Current Codebase Implementation & Cardiological Standards]

To validate cardiac detection algorithms scientifically, researchers test implementations against standard reference databases. The gold standard is the **MIT-BIH Arrhythmia Database** (PhysioNet), recorded between 1975 and 1979 by the Massachusetts Institute of Technology and Beth Israel Hospital (now Beth Israel Deaconess Medical Center, Boston).

The database contains:
* 48 two-channel ambulatory Holter ECG recordings, each 30 minutes in duration.
* Digitized at $360\text{ Hz}$ with 11-bit resolution over a $\pm 5\text{ mV}$ range.
* Independent reference annotations (`.atr`) produced and mutually verified by at least two clinical cardiologists.

---

## Standard ANSI/AAMI EC57 Beat Symbols
[Cardiological Standards & Codebase Implementation]

In compliance with the **ANSI/AAMI EC57:1998/(R)2008** standard (*Testing and Reporting Performance Results for Cardiac Rhythm and ST-Segment Measurement Algorithms*), this application's evaluator (`backend/evaluation/evaluator.py`) evaluates valid heartbeat annotations while strictly excluding non-beat markers:

* **Evaluated Heartbeat Symbols**:
  * `N`: Normal sinus beat
  * `L`: Left bundle branch block
  * `R`: Right bundle branch block
  * `B`: Bundle branch block unspecified
  * `A`: Atrial premature beat
  * `a`: Aberrated atrial premature beat
  * `J`: Nodal (junctional) premature beat
  * `S`: Supraventricular premature beat
  * `V`: Premature ventricular contraction (PVC)
  * `r`: R-on-T premature ventricular contraction
  * `F`: Fusion of ventricular and normal beat
  * `e`: Atrial escape beat
  * `j`: Nodal (junctional) escape beat
  * `n`: Supraventricular escape beat
  * `E`: Ventricular escape beat
  * `/`: Paced beat
  * `f`: Fusion of paced and normal beat
  * `Q`: Unclassifiable beat
  * `?`: Beat not classified during learning
* **Excluded Non-Beat Markers**: Rhythm change markers (`+`), noise annotations (`~`), isolated artifacts (`|`), comments (`"`), and non-conducted P-waves (`x`).

---

## Deterministic Minimum-Cost Bipartite Matching
[Current Codebase Implementation]

Many informal ECG evaluations use an arbitrary greedy nearest-neighbor loop to match detections to reference annotations. However, greedy assignment is non-deterministic: the resulting True Positive and False Positive counts can change depending entirely on which beat is processed first.

In `backend/evaluation/evaluator.py`, matching is framed as a **minimum-cost bipartite assignment problem**:

```text
Reference Annotations (R)          Detections (D)
        r_1 ──────────────────────── d_1
        r_2 ────────────┬─────────── d_2
                        └─────────── d_3
  [Connected Components Formed Within Tolerance ±τ]
  Optimal Assignment Solved via Hungarian Algorithm
```

### Matching Algorithm Specification
1. **Temporal Tolerance Window**:
   A pair $(r_i, d_j)$ is eligible for matching if and only if:
   $$|r_i - d_j| \le \tau_{\text{samples}} = \left\lfloor \frac{\text{tolerance\_ms}}{1000} \cdot f_s \right\rfloor$$
   The default ANSI/AAMI EC57 tolerance is $\pm 150\text{ ms}$ (54 samples at $360\text{ Hz}$).
2. **Connected Component Decomposition**:
   To ensure computational efficiency over long recordings, candidate pairs are decomposed into independent connected subgraphs.
3. **Cost Minimization via Hungarian Algorithm**:
   For each connected component, `scipy.optimize.linear_sum_assignment` solves:
   $$\min \sum_{(i,j) \in \mathcal{M}} |r_i - d_j|$$
4. **Deterministic Tie-Breaking**:
   Equidistant candidate matches are resolved deterministically by adding a microscopic index penalty ($u \cdot 10^{-6} + v \cdot 10^{-10}$), ensuring identical, reproducible results across platforms.
5. **One-to-One Guarantee**:
   Each reference beat matches at most one detection; each detection matches at most one reference beat.

---

## Quantitative Statistical Metrics
[Cardiological Standards & Codebase Implementation]

From the matched assignment $\mathcal{M}$, events are partitioned into:
* **True Positives ($TP$)**: Reference beats successfully matched to a detection within $\pm \tau$.
* **False Positives ($FP$)**: Detections with no corresponding reference beat (extra beats).
* **False Negatives ($FN$)**: Reference beats with no matching detection (missed beats).

From these counts, the evaluator computes standard performance metrics:

### 1. Sensitivity ($Se$)
The percentage of true reference beats successfully detected:
$$\text{Sensitivity} = \frac{TP}{TP + FN} = \frac{TP}{N_{\text{ref}}} \times 100\%$$

### 2. Positive Predictive Value ($PPV$)
The percentage of algorithmic detections that are true heartbeats:
$$\text{PPV} = \frac{TP}{TP + FP} \times 100\%$$

### 3. Detection Error Rate ($DER$)
The total detection failure rate relative to reference volume:
$$\text{DER} = \frac{FP + FN}{TP + FN} \times 100\%$$

### 4. Event Accuracy
The Jaccard-style event accuracy across the evaluated stream:
$$\text{Event Accuracy} = \frac{TP}{TP + FP + FN} \times 100\%$$

### 5. Latency Distribution
For all matched True Positives ($|r_i - d_j|$), the evaluator reports:
* **Mean Absolute Latency**: Systematic timing bias.
* **Median Absolute Latency**: Typical temporal alignment.
* **Maximum Latency**: Worst-case boundary error.
* **Timing Jitter ($\sigma$)**: Standard deviation of temporal latency.

---

## Strict Separation of Historical Literature Results
[From Pan & Tompkins (1985) & Current Codebase Implementation]

> [!IMPORTANT]
> **Ethical Attribution & Benchmarking Distinction**
> The application's Evaluation panel displays two distinct, side-by-side performance cards that are **never combined**:
>
> 1. **`HISTORICAL LITERATURE RESULT — PAN & TOMPKINS (1985)`**:
>    * Sensitivity: **$99.30\%$**
>    * Failure Rate: **$0.675\%$**
>    * Published PPV: **$99.56\%$** *(Derived directly from the paper's reported counts: 116,137 total reference beats, 277 False Negatives, 507 False Positives $\implies TP = 115,860 \implies PPV = 115,860 / (115,860 + 507) \approx 99.56\%$)*.
>    * Explicitly notes historical analog and custom microprocessor hardware differences.
>
> 2. **`OUR IMPLEMENTATION — LIVE BENCHMARK`**:
>    * Displays the actual live Sensitivity, PPV, DER, and Latency computed directly from the current codebase on the selected records.
>
> The historical 1985 paper values must **never** be cited or reported as this application's own performance.

---

## Detection Tolerance vs. Landmark Accuracy
[Application-Specific Design Choice]

A crucial conceptual point:
* The $\pm 150\text{ ms}$ tolerance benchmarks **QRS complex detection** (whether a heartbeat occurred).
* It does **not** validate morphological landmark precision (the exact millisecond placement of $Q, R, S$, or J-points). Morphological accuracy requires dedicated multi-lead manual caliper validation against international CSE/QT databases.

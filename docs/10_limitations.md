# 10. Limitations & Important Notes

## Scientific Honesty & Boundary Conditions
[Application-Specific Design Choice]

To ensure transparency and academic integrity, this chapter details the known limitations, assumptions, and operational boundaries of this software application.

---

## 1. Educational & Research Scope
[Application-Specific Design Choice]

> [!WARNING]
> **Non-Clinical Software Notice**
> This application is strictly an educational demonstration and algorithmic research platform.
> * It has not undergone clinical trials, formal medical software verification (such as IEC 62304), or regulatory certification (such as FDA 510(k) or CE mark).
> * It must **never** be used for primary clinical diagnosis, bedside monitoring, emergency decision support, or treatment planning.

---

## 2. Lead Configuration & Morphological Constraints
[Current Codebase Implementation & Cardiovascular Electrophysiology]

* **Modified Lead II (MLII) Optimization**:
  The default filter cutoff frequencies ($5\text{–}15\text{ Hz}$), integration window ($150\text{ ms}$), and morphological search windows are tuned primarily for modified lead II (MLII) and standard bipolar limb lead II.
* **Atypical & Inverted Leads**:
  In leads where the normal QRS vector produces a predominantly negative deflection (such as Lead V1 or aV_R), the application's delineator flags the beat as a QS complex ($r\_index = \text{null}$). However, multiform ventricular ectopy or marked axis deviation can increase baseline uncertainty during delineation.
* **Pacemaker Artifacts**:
  Artificial cardiac pacemakers generate high-voltage, sub-millisecond electrical pacing spikes with extreme derivative slopes ($\frac{dv}{dt}$). Without hardware or software pace-blanking filters, these spikes can occasionally trigger false positive QRS detections.

---

## 3. Morphological Landmark Delineation Heuristics
[Application-Specific Heuristic]

* **Heuristic Nature**:
  As emphasized throughout this documentation, individual landmark localization ($Q, R, S$, onset, offset) is an **application-specific morphology heuristic layer**, not part of the 1985 Pan-Tompkins algorithm.
* **Noise Sensitivity**:
  Severe electromyographic (EMG) somatic tremor can introduce local extrema into the PR segment or early ST segment, potentially shifting the detected onset or J-point by several samples.
* **Wide QRS Complexes**:
  In severe ventricular conduction defects (such as complete Left Bundle Branch Block, LBBB, with QRS duration $>160\text{ ms}$), the fixed $150\text{ ms}$ integration window may occasionally produce a flattened or bifurcated integrated envelope unless the user widens the integration window slider in the left sidebar.

---

## 4. Interactive Window vs. Full Record Benchmark
[Current Codebase Implementation]

* **Interactive Workspace (10 Seconds)**:
  To maintain smooth 60 FPS playback and responsive 3D conduction animations without overwhelming browser memory, the Interactive Workspace loads and processes the first $10\text{ seconds}$ ($3,600\text{ samples}$ at $360\text{ Hz}$) of a record.
* **Evaluation Benchmark (Configurable)**:
  When deeper statistical rigor is required, the dedicated **Evaluation Benchmark** panel supports evaluating $10\text{s}$, $60\text{s}$, $300\text{s}$, or the complete recording against all ground-truth reference annotations.

---

## 5. Benchmark Performance Differences
[From Pan & Tompkins (1985) & Current Codebase Implementation]

The performance metrics produced by this implementation will naturally differ from the figures reported in the 1985 paper due to:
1. **Filter Implementation Differences**: The 1985 algorithm used integer-coefficient digital recursive filters optimized for an 8-bit microprocessor, whereas this application implements a standard floating-point digital Butterworth bandpass filter via SciPy.
2. **Signal Length & Subsets**: Testing a 60-second or 300-second sample yields different sample statistics than the full 24-hour multi-tape evaluation conducted across the entire database in 1985.
3. **Derived Metrics**: As documented, the $99.56\%$ Positive Predictive Value (PPV) is derived mathematically from the paper's reported error counts, as PPV was not an established reporting standard in 1985.

# 6. QRS Detection vs. QRS Delineation

## The Conceptual & Provenance Distinction
[From Pan & Tompkins (1985) & Application-Specific Heuristic]

A critical distinction in biomedical signal processing—and within this software application—is the boundary between **QRS Detection** and **QRS Delineation**:

| Dimension | Pan-Tompkins Algorithm (1985) | Delineation Layer (`qrs_delineator.py`) |
|---|---|---|
| **Primary Task** | Detects the temporal occurrence of a heartbeat | Isolates individual sub-waves ($Q, R, S$) and boundaries |
| **Output Data** | Single fiducial index (`pt_qrs_index`) | Landmark indices ($Q, R, S, \text{onset}, \text{offset}$) |
| **Signal Analyzed** | Transformed signals (bandpass, derivative, squared, integrated) | Raw original ECG voltage signal |
| **Scientific Origin** | Peer-reviewed 1985 research publication | Application-specific downstream heuristic layer |

> [!IMPORTANT]
> **Important Provenance Requirement**
> The 1985 paper by Pan and Tompkins detected the QRS complex as an integrated whole. It did **not** define rules for identifying $Q$-waves, $S$-waves, or $QRS$ onset/offset.
>
> All delineation algorithms, slope thresholds ($0.12 \times \text{max slope}$), multi-sample persistence rules (3 consecutive samples), and PR-segment baseline windows described in this chapter are **application-specific morphology heuristics**. They must **never** be attributed to Jiapu Pan or Willis J. Tompkins.

---

## The Delineation Pipeline Architecture
[Application-Specific Heuristic & Current Codebase Implementation]

The delineator (`backend/delineation/qrs_delineator.py`) executes downstream of the detector on the raw ECG signal (`signal`):

```text
Pan-Tompkins Fiducial (pt_qrs_index)
       │
       ▼
1. Pre-QRS Isoelectric Baseline Estimation (PR segment)
       │
       ▼
2. Local Morphology Classification (Upright, Biphasic, QS)
       │
       ▼
3. R-Peak Localization (Positive peak; null for QS)
       │
       ├──► Constrained Backward Search for Q Point (Below baseline)
       ├──► Constrained Forward Search for S Point (Below baseline)
       ├──► Multi-Sample Persistent Search for QRS Onset
       └──► Multi-Sample Persistent Search for QRS Offset (J-Point)
```

---

## Step 1: Pre-QRS Isoelectric Baseline Estimation
[Application-Specific Heuristic]

Accurate morphological measurement requires establishing a zero-voltage reference level for each beat. In `qrs_delineator.py`:
* The algorithm samples the **PR segment** immediately preceding the QRS:
  $$\text{Window}: [pt\_qrs\_index - 120\text{ ms}, \quad pt\_qrs\_index - 60\text{ ms}]$$
* The baseline voltage ($V_{\text{iso}}$) is estimated as the **median** of this segment, making it resilient against residual P-wave tails.
* The local standard deviation ($\sigma_{\text{iso}}$) is calculated to establish a dynamic noise margin:
  $$\text{noise\_margin} = \max(2.5 \cdot \sigma_{\text{iso}}, \quad 0.02\text{ mV})$$

---

## Step 2: Morphology Classification & R-Peak Localization
[Application-Specific Heuristic]

Within a search window of $\pm 45\text{ ms}$ centered on `pt_qrs_index`:
* All local maxima and local minima are cataloged.
* **Positive R-Peak**: If a local maximum exceeds the isoelectric baseline by more than `noise_margin`, the candidate closest to `pt_qrs_index` is assigned to `r_index`.
* **True QS / Predominantly Negative Morphology**:
  * If no significant positive deflection exists above the baseline, the beat is classified as a **QS complex**.
  * **Specification Enforcement**: The algorithm **does not** assign the negative nadir to `r_index`. Instead:
    $$r\_index = \text{null}$$
    $$dominant\_deflection\_index = \text{negative nadir}$$
    $$dominant\_deflection\_type = \text{"negative"}$$
  * On the UI, this beat is displayed with a distinctive pink diamond marker labeled **`QS`**.

---

## Step 3: Constrained Q-Point and S-Point Localization
[Application-Specific Heuristic]

Rather than applying an unconstrained global minimum over a window, $Q$ and $S$ are localized using physiological morphological constraints:

### Q-Point (Preceding R)
* Searches backward from `r_index` within an $80\text{ ms}$ window.
* Finds the local minimum immediately preceding the R upstroke.
* **Validation**: The minimum must dip strictly below the isoelectric baseline ($V_{\text{iso}} - V_Q > 0.5 \cdot \text{noise\_margin}$).
* If no negative deflection dips below baseline, $q\_index = \text{null}$.

### S-Point (Following R)
* Searches forward from `r_index` within a $120\text{ ms}$ window.
* Finds the local minimum immediately following the R downstroke.
* **Validation**: The minimum must dip strictly below the isoelectric baseline ($V_{\text{iso}} - V_S > 0.5 \cdot \text{noise\_margin}$).
* In deep PVCs where $|S| > |R|$, the S point is accurately identified as the dominant negative trough following the positive R upstroke.
* If no negative deflection dips below baseline, $s\_index = \text{null}$.

---

## Step 4: QRS Onset and Offset (J-Point) Detection
[Application-Specific Heuristic]

Identifying the true physiological boundaries of the QRS complex is challenging because the waveform transitions gradually into the PR and ST baselines.

### The Problem With Single-Sample Thresholds
Using a single sample with a low slope as the onset or offset is fragile; high-frequency noise ripples can momentarily produce a zero slope during the steepest portion of a QRS complex, causing premature truncation.

### The Multi-Sample Persistence Solution
In `qrs_delineator.py`:
1. The maximum absolute slope ($\text{max\_slope} = \max |\frac{dv}{dt}|$) of the QRS complex is determined.
2. A threshold is established at $12\%$ of maximum slope:
   $$\text{threshold}_{\text{slope}} = 0.12 \cdot \text{max\_slope}$$
3. **Onset Search**: Steps backward from the earliest detected deflection ($Q$ or $R$). The onset is declared only when the signal's absolute slope drops below $\text{threshold}_{\text{slope}}$ and remains below it for **at least 3 consecutive samples**, with amplitude converging within the baseline noise band.
4. **Offset Search (J-Point)**: Steps forward from the latest detected deflection ($R$ or $S$). The offset is declared only when the absolute slope drops below $\text{threshold}_{\text{slope}}$ for **at least 3 consecutive samples**, signaling stable entry into the ST segment.

---

## Visual Presentation on the Interactive Workspace
[Current Codebase Implementation]

When viewing the **Original** stage with the **QRS Delineation** toggle enabled:
* **QRS Onset**: Green vertical dashed line and small circle marker.
* **Q Point**: Amber circle marker labeled **`Q`**.
* **R Peak**: Red circle marker labeled **`R`** (or pink diamond labeled **`QS`** for negative morphology).
* **S Point**: Cyan circle marker labeled **`S`**.
* **QRS Offset (J-point)**: Cyan vertical dashed line and marker.
* **Shaded Complex**: A subtle blue semi-transparent rectangle spanning from onset to offset.
* **Selected-Beat Panel**: Clicking any beat displays exact landmark times, amplitudes, and QRS duration ($t_{\text{offset}} - t_{\text{onset}}$ in milliseconds).

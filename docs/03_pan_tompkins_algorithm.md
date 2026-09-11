# 3. What Is the Pan-Tompkins Algorithm?

## Historical Context & Development
[From Pan & Tompkins (1985)]

In March 1985, **Jiapu Pan** and **Willis J. Tompkins** published a landmark paper in the *IEEE Transactions on Biomedical Engineering*:

> **Citation**: J. Pan and W. J. Tompkins, "A Real-Time QRS Detection Algorithm," *IEEE Transactions on Biomedical Engineering*, vol. BME-32, no. 3, pp. 230–236, March 1985.

At the time, digital ECG processing was constrained by the limited processing power and memory of 8-bit microprocessors (such as the Zilog Z80). Complex Fourier transforms or multi-layer neural networks were computationally impossible in real-time embedded cardiac monitors.

Pan and Tompkins designed a computationally elegant, integer-friendly signal processing pipeline followed by dual-signal adaptive thresholding logic that achieved state-of-the-art detection accuracy using basic arithmetic operations (addition, subtraction, shift, and squaring).

---

## Why Automated QRS Detection Is Difficult
[Cardiovascular Electrophysiology & Pan-Tompkins 1985]

If an ECG signal consisted of textbook waveforms on a zero-volt line, detection would be trivial: a simple threshold rule `if voltage > 1.0 mV: beat()` would suffice.

In clinical reality, surface recordings are contaminated by multiple physiological and environmental noise sources:

| Noise Source | Typical Frequency Range | Physical Cause | Clinical Manifestation |
|---|---|---|---|
| **Baseline Wander** | $0.15\text{–}0.5\text{ Hz}$ | Respiration, chest expansion, perspiration | The entire signal drifts vertically across the display. |
| **Electromyographic (EMG) Noise** | Broadband ($20\text{–}>100\text{ Hz}$) | Skeletal muscle contraction, shivering | Rapid, high-frequency jagged spikes that mimic steep slopes. |
| **Powerline Interference** | $50\text{ Hz}$ or $60\text{ Hz}$ | AC mains radiation, inadequate grounding | Continuous sinusoidal oscillation obscuring fine wave detail. |
| **Electrode Motion Artifact** | $1\text{–}10\text{ Hz}$ | Movement pulling on lead wires | Abrupt step-changes and transient spikes mimicking QRS peaks. |
| **Tall Peaked T-Waves** | $1\text{–}5\text{ Hz}$ | Hyperkalemia, ischemia, anatomical variations | Large repolarization waves that rival the QRS in amplitude, risking double-counting. |

---

## Why Static Thresholds Fail
[From Pan & Tompkins (1985)]

A fixed (static) threshold is entirely unsuitable for clinical ECG analysis because:
1. **Inter-Patient Variability**: One patient's QRS amplitude may measure $2.5\text{ mV}$, while an emphysematous patient's recording may peak at only $0.4\text{ mV}$.
2. **Intra-Patient Dynamic Changes**: Respiration, position changes, or ectopic beats (such as Premature Ventricular Contractions, PVCs) cause beat-to-beat amplitude fluctuations.
3. **Drifting Noise Levels**: Background noise rises when a patient shivers and drops when they relax. A static threshold either produces rampant False Positives ($FP$) during noise bursts or rampant False Negatives ($FN$) during low-voltage episodes.

---

## The Pan-Tompkins Solution: Dual Adaptive Thresholds
[From Pan & Tompkins (1985)]

To overcome these challenges, Pan and Tompkins introduced:
* **A 5-stage transformation pipeline** that cleans noise, highlights steep slopes, non-linearly suppresses low-amplitude waves, and aggregates QRS energy into smooth pulse envelopes.
* **Continuous adaptive learning**: The algorithm continuously updates running estimates of signal peaks ($SPK$) and noise peaks ($NPK$).
* **Dual thresholds ($TH_1, TH_2$)**: A primary threshold confirms obvious beats; a secondary lower threshold enables **search-back** to recover missed low-amplitude beats when a physiological timeout expires.
* **Dual signal validation**: Candidate events must satisfy adaptive thresholds on **both** the moving-window integrated signal and the bandpass-filtered signal.
* **Physiological blanking & T-wave discrimination**: Enforcing a 200 ms refractory blanking period prevents double-triggering, while relative slope testing distinguishes true ventricular activations from elevated T-waves.

---

## Important Scope Distinction: Detection vs. Delineation
[From Pan & Tompkins (1985) & Current Codebase Implementation]

> [!IMPORTANT]
> **QRS Detection vs. Q/R/S Wave Delineation**
> The original 1985 Pan-Tompkins algorithm is strictly a **QRS detection algorithm**. It outputs a single temporal timestamp per heartbeat (a fiducial mark `pt_qrs_index`).
>
> The 1985 paper does **not**:
> * detect individual Q, R, or S landmark waves;
> * determine whether an R-peak is positive or inverted;
> * estimate the onset or offset (J-point) of the QRS complex;
> * measure QRS duration.
>
> In this software application, individual Q, R, and S landmarks and QRS boundaries are produced by a **dedicated downstream morphology analysis layer** (`qrs_delineator.py`), which is an application-specific heuristic layer running on the raw ECG signal after Pan-Tompkins has detected the beat.

# 5. Adaptive Decision Logic

## Why Adaptive Processing Is Essential
[From Pan & Tompkins (1985)]

In biological signals, the amplitude of both the cardiac waveform and background noise continuously drifts due to electrode movement, respiration, and autonomic nervous system changes.

The core contribution of the Pan-Tompkins algorithm is an **adaptive dual-signal decision engine** that continuously estimates the signal peak level and noise peak level on two separate waveforms simultaneously:
1. The **Moving-Window Integrated Waveform** (energy and width information).
2. The **Bandpass-Filtered Waveform** (frequency and morphology information).

---

## The Learning Phase (First 2 Seconds)
[From Pan & Tompkins (1985) & Current Codebase Implementation]

Before active detection begins, the algorithm requires an initialization phase to calibrate signal and noise levels. In `backend/pan_tompkins/detector.py`, the first $2.0\text{ seconds}$ of data ($\min(N, 2 \times f_s)$) are analyzed:

```python
# Initial estimates on first 2 seconds
spki = 0.35 * float(np.max(learn_integrated))   # Signal Peak Level (Integrated)
npki = float(np.mean(learn_integrated))          # Noise Peak Level (Integrated)
spkf = 0.35 * float(np.max(learn_filtered))     # Signal Peak Level (Filtered)
npkf = float(np.mean(learn_filtered))           # Noise Peak Level (Filtered)

# Initial running RR interval baseline (0.8s baseline = 75 BPM)
init_rr = int(0.8 * fs)
recent_rr = [init_rr] * 8
acceptable_rr = [init_rr] * 8
```

---

## Signal and Noise Level Tracking
[From Pan & Tompkins (1985) & Current Codebase Implementation]

The detector maintains four continuously updated parameters:
* $SPKI$: Running estimate of Signal Peak in the **Integrated** waveform.
* $NPKI$: Running estimate of Noise Peak in the **Integrated** waveform.
* $SPKF$: Running estimate of Signal Peak in the **Bandpass-Filtered** waveform.
* $NPKF$: Running estimate of Noise Peak in the **Bandpass-Filtered** waveform.

### Updating Upon Confirmed QRS Detection
When a candidate peak ($PEAKI, PEAKF$) is accepted as a valid QRS complex, signal levels update using a recursive exponential moving average ($1/8$ new, $7/8$ old):

$$SPKI \leftarrow 0.125 \cdot PEAKI + 0.875 \cdot SPKI$$
$$SPKF \leftarrow 0.125 \cdot PEAKF + 0.875 \cdot SPKF$$

### Updating Upon Noise Peak
When a candidate peak fails detection thresholds or is rejected, it is classified as a noise event, updating the noise floor:

$$NPKI \leftarrow 0.125 \cdot PEAKI + 0.875 \cdot NPKI$$
$$NPKF \leftarrow 0.125 \cdot PEAKF + 0.875 \cdot NPKF$$

---

## Primary and Secondary Adaptive Thresholds
[From Pan & Tompkins (1985) & Current Codebase Implementation]

From the running signal and noise estimates, the algorithm calculates primary detection thresholds positioned $25\%$ above the noise floor:

### Integrated Signal Thresholds
$$\text{THRESHOLD\_I1} = NPKI + 0.25 \cdot (SPKI - NPKI)$$
$$\text{THRESHOLD\_I2} = 0.5 \cdot \text{THRESHOLD\_I1} \quad \text{(Search-Back)}$$

### Bandpass-Filtered Signal Thresholds
$$\text{THRESHOLD\_F1} = NPKF + 0.25 \cdot (SPKF - NPKF)$$
$$\text{THRESHOLD\_F2} = 0.5 \cdot \text{THRESHOLD\_F1} \quad \text{(Search-Back)}$$

---

## Dual-Threshold Confirmation
[From Pan & Tompkins (1985) & Current Codebase Implementation]

For an event to be accepted during the standard forward pass, it must satisfy **both** criteria:

$$\big( PEAKI > \text{THRESHOLD\_I1} \big) \quad \text{AND} \quad \big( PEAKF > \text{THRESHOLD\_F1} \big)$$

This dual confirmation drastically reduces false positives:
* Muscle twitch noise may cause a brief spike in the derivative and filtered signal, but lacks the sustained energy required to cross $\text{THRESHOLD\_I1}$.
* A broad baseline artifact may produce a large area under the integration curve, but lacks the steep slopes required to cross $\text{THRESHOLD\_F1}$.

---

## 200 ms Physiological Refractory Blanking
[From Pan & Tompkins (1985) & Current Codebase Implementation]

Following any accepted QRS complex, human ventricular cardiac cells enter a physiological **absolute refractory period** during which another ventricular depolarization is physically impossible.

The algorithm enforces a strict blanking window:

$$\Delta t_{\text{refractory}} = 0.200\text{ s} \quad (72\text{ samples at } 360\text{ Hz})$$

Any candidate peak occurring within $200\text{ ms}$ of the preceding QRS is immediately discarded, preventing double detection of bifurcated peaks or ringing filter responses.

---

## T-Wave Discrimination (200 ms – 360 ms)
[From Pan & Tompkins (1985) & Current Codebase Implementation]

Candidate peaks occurring between $200\text{ ms}$ and $360\text{ ms}$ after a confirmed QRS complex fall into the physiological window for ventricular repolarization (the T-wave).

To prevent an elevated or peaked T-wave from triggering a false QRS detection:
1. The derivative slope ($\text{cand\_slope}$) of the candidate event is measured.
2. It is compared against the slope of the preceding confirmed QRS ($\text{last\_qrs\_slope}$).
3. **Decision Rule**:
   $$\text{If } \text{cand\_slope} < 0.5 \cdot \text{last\_qrs\_slope} \implies \text{Classified as T-Wave}$$

If classified as a T-wave:
* It is rejected from the beat stream.
* It updates the noise peak estimates ($NPKI, NPKF$) rather than signal levels.
* It appears in the application's UI with a hollow purple marker and tooltip: `"Rejected: T-wave"`.

---

## Search-Back for Missed Beats
[From Pan & Tompkins (1985) & Current Codebase Implementation]

If a patient experiences an abrupt drop in cardiac amplitude (e.g., during a run of ventricular ectopy or sudden conduction block), the primary thresholds ($\text{THRESHOLD\_I1}, \text{THRESHOLD\_F1}$) may be too high, causing missed beats.

To recover these beats:
1. **Missed-Beat Timeout**: The detector tracks the interval since the last accepted QRS:
   $$\text{Timeout} = 1.66 \cdot RR_{\text{avg2}}$$
2. **Search-Back Pass**: If $\Delta t > \text{Timeout}$, the detector immediately re-evaluates candidate peaks in its noise pool occurring between $(last\_qrs + 200\text{ ms})$ and the current time.
3. **Secondary Acceptance Criteria**:
   $$\big( PEAKI > \text{THRESHOLD\_I2} \big) \quad \text{AND} \quad \big( PEAKF > \text{THRESHOLD\_F2} \big)$$
4. The most prominent candidate satisfying both secondary thresholds is promoted to an accepted QRS detection.
5. **Search-Back Learning**: To adapt quickly to the lowered signal amplitude, search-back beats update signal levels with higher weighting:
   $$SPKI \leftarrow 0.25 \cdot PEAKI + 0.75 \cdot SPKI$$
   $$SPKF \leftarrow 0.25 \cdot PEAKF + 0.75 \cdot SPKF$$
6. Detections recovered via search-back appear on the UI with an amber diamond marker and label: `"Search-back"`.

---

## Dual Running RR Interval Averages
[From Pan & Tompkins (1985) & Current Codebase Implementation]

To distinguish physiological rate changes from arrhythmias, the detector maintains two separate running RR interval averages across 8-beat FIFO buffers:

* **$RR_{\text{avg1}}$ (Recent 8 Beats)**:
  Arithmetic mean of the most recent 8 detected RR intervals, reflecting current heart rate.
* **$RR_{\text{avg2}}$ (Acceptable 8 Beats)**:
  Arithmetic mean of the most recent 8 intervals that fall within strict physiological bounds:
  $$0.92 \cdot RR_{\text{avg2}} \le RR_i \le 1.16 \cdot RR_{\text{avg2}}$$

When an irregular beat (such as a premature ventricular contraction or sinus pause) occurs, it updates $RR_{\text{avg1}}$ to reflect the rhythm shift, but is excluded from $RR_{\text{avg2}}$. This prevents an ectopic beat from skewing the missed-beat search timeout.

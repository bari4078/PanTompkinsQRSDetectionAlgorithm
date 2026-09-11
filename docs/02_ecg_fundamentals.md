# 2. ECG Fundamentals

## What Is an ECG Signal to a Computer?
[Current Codebase Implementation]

From a software engineering perspective, a digital Electrocardiogram (ECG) is a discrete 1D time series array of floating-point numbers:

$$x[n] = [v_0, v_1, v_2, \dots, v_{N-1}]$$

where:
* $n$ is the discrete sample index ($0 \le n < N$).
* $v_n$ represents the digitized electrical potential (typically in millivolts, $\text{mV}$).
* $f_s$ is the sampling frequency in Hertz ($\text{Hz}$). For example, in the MIT-BIH Arrhythmia Database, $f_s = 360\text{ Hz}$, meaning 360 voltage readings are acquired every second ($\Delta t = 1/f_s \approx 2.78\text{ ms}$ per sample).

A 10-second segment at $360\text{ Hz}$ contains exactly $360 \times 10 = 3,600$ sequential floating-point samples.

---

## Anatomy of a Normal Cardiac Cycle
[Cardiovascular Electrophysiology]

A single normal heartbeat consists of a sequence of electrical deflections that correspond directly to mechanical contraction and relaxation of the cardiac chambers:

```text
       R (+ peak)
       /\
      /  \
     /    \
 P  /      \             T
/\ /        \           /\
--\---------/\---------/--\--- (Isoelectric Baseline)
   Q        S
   |<-PR--->|<--QRS-->|<-ST->|
   |<---------QT------------>|
```

### The Individual Waveforms

1. **P Wave**:
   * **Physiology**: Depolarization (electrical activation) of the left and right atria, triggering atrial contraction.
   * **Characteristics**: Low amplitude ($\sim 0.1\text{ to }0.25\text{ mV}$), low frequency, smooth and rounded.

2. **PR Segment & Isoelectric Baseline**:
   * **Physiology**: Conduction delay as the electrical impulse travels through the Atrioventricular (AV) node into the Bundle of His.
   * **Characteristics**: Flat isoelectric baseline between the end of the P wave and the start of the QRS complex. This baseline serves as the zero-voltage reference for morphological measurements.

3. **QRS Complex**:
   * **Physiology**: Rapid depolarization of both ventricles. Because ventricular muscle mass is vastly larger than atrial mass, this electrical vector generates the largest amplitude on the surface ECG.
   * **Constituent Waves**:
     * **Q Point**: First negative deflection preceding the R peak.
     * **R Peak**: First positive deflection above the isoelectric baseline.
     * **S Point**: First negative deflection following the R peak.
   * **Normal Duration**: 80 to 120 ms in healthy adults.

4. **ST Segment**:
   * **Physiology**: Plateau phase of ventricular repolarization where ventricular muscle cells are uniformly depolarized.
   * **Characteristics**: Isoelectric line connecting the end of the S wave (J-point) to the beginning of the T wave.

5. **T Wave**:
   * **Physiology**: Ventricular repolarization (recovery of cardiac myocytes in preparation for the next cycle).
   * **Characteristics**: Asymmetric, medium-amplitude upward deflection ($\sim 0.2\text{ to }0.5\text{ mV}$), with a gentler upward slope and steeper downward slope.

---

## Key Quantitative Cardiac Metrics
[Cardiovascular Electrophysiology & Codebase Implementation]

In this application, detected QRS complexes are converted into quantitative clinical metrics displayed in the top status bar:

### 1. RR Interval ($RR_i$)
The temporal distance between consecutive R-peaks:

$$RR_i = \frac{R_i - R_{i-1}}{f_s} \quad \text{[seconds]}$$

### 2. Instantaneous Heart Rate ($HR$)
The instantaneous heart rate in beats per minute (BPM) derived from the mean RR interval over the analyzed segment:

$$HR = \frac{60}{\overline{RR}} \quad \text{[BPM]}$$

In healthy resting adults, normal sinus rhythm is typically between $60\text{ and }100\text{ BPM}$.

### 3. Heart Rate Variability: SDNN
The standard deviation of normal-to-normal (NN) intervals:

$$\text{SDNN} = \sqrt{\frac{1}{M-1} \sum_{i=1}^{M} (RR_i - \overline{RR})^2} \times 1000 \quad \text{[ms]}$$

SDNN reflects autonomic nervous system balance and cardiovascular resilience.

---

## Why the QRS Complex Is the Ideal Target
[Cardiovascular Electrophysiology & Pan-Tompkins 1985]

Automated heartbeat counters focus almost exclusively on the QRS complex for three reasons:

| Property | QRS Complex | P Wave & T Wave | Signal Processing Advantage |
|---|---|---|---|
| **Amplitude** | High ($0.5\text{ to }3.0\text{ mV}$) | Low ($0.1\text{ to }0.4\text{ mV}$) | High Signal-to-Noise Ratio (SNR) |
| **Slope ($\frac{dv}{dt}$)** | Very steep ($> 10\text{ mV/s}$) | Gentle slope | Highlighted by mathematical differentiation |
| **Frequency Content** | Concentrated in $5\text{–}15\text{ Hz}$ | Low frequencies ($< 5\text{ Hz}$) | Isolatable via bandpass filtering |

Because the QRS complex is both the steepest and tallest feature of the heartbeat, a properly designed filter pipeline can isolate it even under adverse recording conditions.

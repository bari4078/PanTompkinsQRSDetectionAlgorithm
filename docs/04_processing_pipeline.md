# 4. Pan-Tompkins Processing Pipeline

## Overview of the Signal Pipeline
[From Pan & Tompkins (1985) & Current Codebase Implementation]

The Pan-Tompkins algorithm transforms the noisy, multi-component ECG signal through five sequential mathematical stages. Each stage is designed to suppress specific noise components and enhance the distinctive characteristics of the QRS complex:

```text
Raw ECG [original]
       │
       ▼
1. Bandpass Filter (5–15 Hz) [bandpass]
       │
       ▼
2. 5-Point Derivative Filter [derivative]
       │
       ▼
3. Pointwise Squaring [squared]
       │
       ▼
4. Moving Window Integration (~150 ms) [integrated]
       │
       ▼
5. Adaptive Decision Logic & Fiducial Mapping [peaks_original]
```

---

## Stage 1: Bandpass Filter
[From Pan & Tompkins (1985) & Current Codebase Implementation]

### The Objective
To isolate the frequency band containing the maximum QRS energy while attenuating out-of-band physiological and environmental interference.

### Mathematical Implementation
* **In the 1985 Paper**: Pan and Tompkins cascaded a 2nd-order low-pass filter (cutoff $\approx 11\text{ Hz}$) and a high-pass filter (cutoff $\approx 5\text{ Hz}$) designed with integer coefficients for fast 8-bit microprocessor computation.
* **In This Application (`backend/pan_tompkins/filters.py`)**: A digital Butterworth bandpass filter is implemented using `scipy.signal.butter` and `lfilter`:
  $$\text{Normalized cutoffs}: \quad w_{\text{low}} = \frac{f_{\text{low}}}{0.5 \cdot f_s}, \quad w_{\text{high}} = \frac{f_{\text{high}}}{0.5 \cdot f_s}$$
  Default parameters: $f_{\text{low}} = 5.0\text{ Hz}$, $f_{\text{high}} = 15.0\text{ Hz}$, order $n=1$.

### Noise Attenuation
* **Low-frequency cutoff ($5\text{ Hz}$)**: Eliminates baseline wander caused by respiration and slow motion artifacts.
* **High-frequency cutoff ($15\text{ Hz}$)**: Suppresses electromyographic (EMG) skeletal muscle noise, $50/60\text{ Hz}$ powerline hum, and high-frequency transducer noise.

### Visual Representation on the UI
* The baseline is stabilized around zero volts.
* High-frequency "fuzz" is smoothed out, revealing clean P-waves, QRS spikes, and T-waves.

---

## Stage 2: Five-Point Derivative Filter
[From Pan & Tompkins (1985) & Current Codebase Implementation]

### The Objective
To extract slope information ($\frac{dv}{dt}$). Because the QRS complex exhibits the steepest rise and fall times in the cardiac cycle, differentiation suppresses slow waves (P-wave and T-wave) and amplifies QRS transitions.

### Mathematical Formulation
Pan and Tompkins designed a 5-point differentiator with the difference equation:

$$y[n] = \frac{1}{8T} \Big( -x[n-2] - 2x[n-1] + 2x[n+1] + x[n+2] \Big)$$

where $T = 1/f_s$ is the sampling period.

In `backend/pan_tompkins/filters.py`:
```python
# Standard Pan-Tompkins 5-point derivative kernel
# Convolved with mode='same' and scaled by fs (1/T)
h_d = [1/8, 2/8, 0, -2/8, -1/8]
derivative = np.convolve(signal, h_d, mode='same') * fs
```

### Frequency Response
The derivative filter acts as a high-pass filter with linear phase, producing maximum response at approximately $30\text{ to }40\text{ Hz}$. Because P-waves and T-waves have low slopes, their output is suppressed to near-zero.

### Visual Representation on the UI
* The signal oscillates above and below zero with large, sharp spikes corresponding to the steepest edges of each QRS.
* P-waves and T-waves appear as negligible ripples.

---

## Stage 3: Pointwise Squaring
[From Pan & Tompkins (1985) & Current Codebase Implementation]

### The Objective
To enforce unipolar (strictly positive) signal values and perform non-linear amplification of large slope events.

### Mathematical Formulation
$$y[n] = \big( x[n] \big)^2$$

In `backend/pan_tompkins/filters.py`:
```python
return np.square(signal)
```

### Purpose & Detection Contribution
1. **Unipolarity**: Inverts negative slope components into positive values, treating both rising and falling edges of the QRS as positive evidence.
2. **Non-Linear Amplification**: Values $> 1$ grow quadratically, whereas background noise values $< 1$ are suppressed. For example, a signal peak of $4.0$ becomes $16.0$, while a noise ripple of $0.5$ shrinks to $0.25$. The QRS complex now towers above the background baseline.

### Visual Representation on the UI
* The waveform is strictly $\ge 0$.
* Steep QRS edges appear as distinct clusters of positive energy spikes.

---

## Stage 4: Moving Window Integration
[From Pan & Tompkins (1985) & Current Codebase Implementation]

### The Objective
To consolidate multiple slope spikes from a single QRS complex into one smooth, distinct energy pulse envelope.

### Mathematical Formulation
$$y[n] = \frac{1}{N} \sum_{k=0}^{N-1} x[n-k]$$

where $N$ is the number of samples in the integration window:

$$N = \left\lfloor \frac{\text{window\_size\_ms}}{1000} \cdot f_s \right\rfloor$$

At $f_s = 360\text{ Hz}$ with the standard $150\text{ ms}$ window, $N = \lfloor 0.150 \times 360 \rfloor = 54\text{ samples}$.

In `backend/pan_tompkins/filters.py`:
```python
window = np.ones(window_size) / window_size
integrated = np.convolve(signal, window, mode='same')
```

### Window Width Tuning
* **Too narrow ($< 80\text{ ms}$)**: A single wide or biphasic QRS complex produces multiple distinct peaks, causing double detection.
* **Too wide ($> 200\text{ ms}$)**: The integration window merges the QRS complex with an adjacent tall T-wave, causing elevated noise levels or late detections.
* **Optimal width ($\sim 150\text{ ms}$)**: Approximately matches the physiological duration of normal to moderately wide QRS complexes ($80\text{–}120\text{ ms}$).

### Visual Representation on the UI
* The jagged squaring spikes are smoothed into smooth, dome-shaped hills.
* Each heartbeat is now represented by exactly **one distinct, countable energy lump**.

---

## Stage 5: Fiducial Mapping to Raw ECG
[From Pan & Tompkins (1985) & Current Codebase Implementation]

Because moving-window integration and digital filtering introduce a finite group delay, the peak of the integrated waveform ($P_{\text{int}}$) occurs slightly **after** the physiological R-peak in the patient's raw ECG.

To establish the exact fiducial timestamp on the patient's raw ECG:
1. Candidate peaks are first identified as local maxima in the integrated waveform (`peaks_integrated`).
2. The algorithm searches backward in the bandpass-filtered signal within a window of $P_{\text{int}} - N$ to find the maximum filtered absolute value ($F_{\text{idx}}$).
3. The true R-peak (`peaks_original` / `pt_qrs_index`) is identified by locating the local extremum on the **raw ECG signal** within $\pm 40\text{ ms}$ of $F_{\text{idx}}$.

This mapping locks the Pan-Tompkins detection timestamp directly to the physical R-peak of the raw ECG.

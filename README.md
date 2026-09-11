# Pan-Tompkins QRS Detection & Real-Time Cardiac Conduction Analysis

An end-to-end electrophysiological signal processing and visualization platform. This project implements the classical **Pan-Tompkins algorithm (1985)** for real-time QRS complex detection from electrocardiogram (ECG) signals, coupled with dynamic heart rate variability (HRV) metrics, arrhythmia classification, and an interactive 3D cardiac conduction visualizer.

---

## Table of Contents
- [1. Overview](#1-overview)
- [2. System Architecture](#2-system-architecture)
- [3. Methodology: Pan-Tompkins Algorithm](#3-methodology-pan-tompkins-algorithm)
  - [Phase 1: Bandpass Filtering (5–15 Hz)](#phase-1-bandpass-filtering-515-hz)
  - [Phase 2: Derivative Operator](#phase-2-derivative-operator)
  - [Phase 3: Squaring Function](#phase-3-squaring-function)
  - [Phase 4: Moving-Window Integration (MWI)](#phase-4-moving-window-integration-mwi)
  - [Phase 5: Adaptive Peak Detection & Alignment](#phase-5-adaptive-peak-detection--alignment)
- [4. Clinical Metrics & Arrhythmia Analysis](#4-clinical-metrics--arrhythmia-analysis)
- [5. Interactive 3D Cardiac Visualizer](#5-interactive-3d-cardiac-visualizer)
- [6. How to Run the Project](#6-how-to-run-the-project)
  - [Prerequisites](#prerequisites)
  - [Option A: Automated One-Script Launch (macOS & Linux)](#option-a-automated-one-script-launch-macos--linux)
  - [Option B: Manual Setup (macOS / Linux / Windows)](#option-b-manual-setup-macos--linux--windows)
  - [Option C: Windows Automated Launch](#option-c-windows-automated-launch)
- [7. API Reference](#7-api-reference)
- [8. In-Depth Discussion & Engineering Trade-offs](#8-in-depth-discussion--engineering-trade-offs)
- [9. References](#9-references)

---

## 1. Overview

Accurate detection of the **QRS complex** is the foundation for automated ECG interpretation, heart rate variability (HRV) tracking, and diagnosis of cardiac arrhythmias (such as ventricular tachycardia, fibrillation, or bundle branch blocks). The QRS complex represents electrical depolarization of the ventricular myocardium and constitutes the most prominent feature in a cardiac cycle.

This repository combines:
1. **Algorithmic Signal Processing Engine:** A modular Python/FastAPI backend executing the multistage Pan-Tompkins filtering pipeline and real-time arrhythmia diagnostics on PhysioNet MIT-BIH Arrhythmia database records.
2. **Interactive Clinical Dashboard:** A modern React + Vite frontend featuring dual signal inspection (raw, bandpass, derivative, squared, and integrated waves), real-time animated playhead, and a synchronized 3D cardiac conduction model powered by Three.js / React Three Fiber.

---

## 2. System Architecture

```text
                               MIT-BIH Database (PhysioNet)
                                            │
                                            ▼
                           ┌─────────────────────────────────┐
                           │      FastAPI Backend (:8000)    │
                           │ ─────────────────────────────── │
                           │  • DataLoader (WFDB)            │
                           │  • Pan-Tompkins Pipeline        │
                           │  • Metrics & Arrhythmia Engine  │
                           └────────────────┬────────────────┘
                                            │ REST API (JSON)
                                            ▼
                           ┌─────────────────────────────────┐
                           │     React + Vite Client (:5173) │
                           │ ─────────────────────────────── │
                           │  • Interactive Stage Inspector  │
                           │  • Dynamic Parameter Tuning     │
                           │  • Synchronized Playback Engine │
                           │  • 3D WebGL Conduction Model    │
                           └───────────────────────────────┘
```

### Key Modules
- **`backend/pan_tompkins/`**: Object-oriented implementation adhering to the Strategy pattern. Each filter (`BandpassFilter`, `DerivativeFilter`, `SquaringFilter`, `MovingWindowIntegration`) acts as an interchangeable strategy unified under `PanTompkinsDetector`.
- **`backend/data_loader.py`**: Automated download and caching of MIT-BIH recordings using `wfdb`.
- **`backend/analysis.py`**: Extraction of RR intervals, time-domain HRV indices ($SDNN$, $RMSSD$), rhythm classification, and blood pressure estimation heuristics.
- **`frontend/src/`**: Interactive dashboard utilizing React 19, Plotly.js for high-fidelity waveform rendering, and React Three Fiber for spatial heart animations.

---

## 3. Methodology: Pan-Tompkins Algorithm

The Pan-Tompkins algorithm isolates QRS complexes by attenuating physiological and non-physiological noise (baseline wander from respiration, 50/60 Hz power-line interference, electromyographic / muscle artifacts, and tall peaked T-waves).

```text
Raw ECG [x(n)]
      │
      ▼
┌──────────────┐      Passband: 5 - 15 Hz
│ Bandpass     │ ───► Attenuates baseline drift & high-frequency muscle noise
└──────┬───────┘
       ▼
┌──────────────┐      Filter: (1/8T) * [-x(n-2) - 2x(n-1) + 2x(n+1) + x(n+2)]
│ Derivative   │ ───► Amplifies steep slopes of QRS complexes
└──────┬───────┘
       ▼
┌──────────────┐      Equation: y(n) = [x(n)]²
│ Squaring     │ ───► Enforces non-linear amplification and positive polarity
└──────┬───────┘
       ▼
┌──────────────┐      Window width: ~150 ms
│ Moving-Window│ ───► Integrates energy; creates distinct unified pulses
│ Integration  │
└──────┬───────┘
       ▼
┌──────────────┐      Adaptive thresholding & physiological refractory period (300 ms)
│ Peak Search  │ ───► Aligns integrated peaks back to exact R-peaks in original signal
└──────────────┘
```

### Phase 1: Bandpass Filtering (5–15 Hz)
The energy of the QRS complex is primarily concentrated between 5 Hz and 15 Hz.
- Low frequencies (< 5 Hz) caused by respiratory baseline drift and P/T wave fluctuations are attenuated.
- High frequencies (> 15 Hz) corresponding to powerline interference, 60 Hz hum, and electromyographic (EMG) noise are eliminated.
Implemented using a cascaded Butterworth bandpass filter.

### Phase 2: Derivative Operator
To emphasize the steep slope of the QRS onset and downstroke over slower P and T wave transitions, a five-point central difference derivative filter is applied:

$$y[n] = \frac{1}{8T} \left(-x[n-2] - 2x[n-1] + 2x[n+1] + x[n+2]\right)$$

where $T$ is the sampling interval ($T = 1/f_s$).

### Phase 3: Squaring Function
Pointwise squaring:

$$y[n] = (x[n])^2$$

This non-linear transformation:
1. Yields strictly positive values.
2. Quadratically amplifies larger values (high derivative steepness from QRS complexes) relative to noise and residual T-wave peaks.

### Phase 4: Moving-Window Integration (MWI)
A moving average window accumulates energy information over the approximate duration of an average QRS complex:

$$y[n] = \frac{1}{N} \sum_{k=0}^{N-1} x[n - k]$$

Where $N$ corresponds to a default duration of 150 ms ($N = \lfloor 0.15 \times f_s \rfloor$).
- If $N$ is too narrow, a single QRS event could trigger multiple peaks.
- If $N$ is too wide, the QRS complex merges with the following T-wave.

### Phase 5: Adaptive Peak Detection & Alignment
1. **Dynamic Threshold:** The threshold adapts to local signal energy:
   $$\text{Threshold} = \mu_{\text{integrated}} + 0.5 \times \sigma_{\text{integrated}}$$
2. **Refractory Blanking Window:** A minimum distance constraint ($d_{\min} = 0.3 \times f_s$, or 300 ms) guarantees the detector complies with human physiological refractory periods (preventing double detections up to 200 BPM).
3. **Delay Correction & Fiducial R-Peak Mapping:** The moving window introduces a phase delay. Candidate peaks in the integrated wave are back-propagated to the original raw ECG within a localized 150 ms window to isolate the exact maximum voltage point (the true **R-peak**).

---

## 4. Clinical Metrics & Arrhythmia Analysis

Once the R-peak indices are isolated, consecutive differences define the **RR interval series**:

$$RR_i = \frac{R_{i+1} - R_i}{f_s}$$

From $RR_i$, the system computes:
- **Heart Rate (HR):**
  $$\text{HR} = \frac{60}{\overline{RR}} \quad (\text{BPM})$$
- **Standard Deviation of NN intervals ($SDNN$):** Quantifies total autonomic variability over the recorded window.
  $$SDNN = \sqrt{\frac{1}{M-1} \sum_{i=1}^M (RR_i - \overline{RR})^2} \times 1000 \quad (\text{ms})$$
- **Root Mean Square of Successive Differences ($RMSSD$):** Reflects high-frequency vagal / parasympathetic modulation.
  $$RMSSD = \sqrt{\frac{1}{M-1} \sum_{i=1}^{M-1} (RR_{i+1} - RR_i)^2} \times 1000 \quad (\text{ms})$$
- **Automated Arrhythmia Classification:**
  - **Bradycardia:** Mean $\text{HR} < 60\text{ BPM}$
  - **Tachycardia:** Mean $\text{HR} > 100\text{ BPM}$
  - **Irregular Rhythm:** Marked variance in RR intervals ($SDNN > 100\text{ ms}$)

---

## 5. Interactive 3D Cardiac Visualizer

The frontend correlates the electrical time domain with anatomical electrophysiology:
- **Playhead Tracking:** Scrubbing or playing the ECG signal moves a 60 FPS playhead synchronized with the detected R-peaks.
- **P-QRS-T Conduction Simulation:** As the timeline advances through each detected cardiac cycle, the 3D heart model activates its myocardial chambers:
  - Atrial depolarization (P-wave) -> SA to AV node delay.
  - Ventricular depolarization (QRS) -> Bundle of His to Purkinje activation with chamber contraction impulse.
  - Ventricular repolarization (T-wave) -> Myocardial relaxation.

---

## 6. How to Run the Project

### Prerequisites
- **Python 3.10+** (Homebrew Python on macOS works seamlessly via the bundled virtual environment setup)
- **Node.js 18+** and **npm**
- **Git**

---

### Option A: Automated One-Script Launch (macOS & Linux)

The repository includes `run_main.sh`, which automatically builds an isolated Python virtual environment, installs backend and frontend packages, and boots both servers:

```bash
chmod +x run_main.sh
./run_main.sh
```

- **Backend API:** [http://localhost:8000](http://localhost:8000)
- **Frontend Dashboard:** [http://localhost:5173](http://localhost:5173)
- Press `Ctrl + C` in the terminal to terminate both processes cleanly.

---

### Option B: Manual Setup (macOS / Linux / Windows)

#### Step 1: Start the Backend (Terminal 1)
```bash
# Navigate to backend directory
cd backend

# Create and activate a virtual environment
# On macOS / Linux:
python3 -m venv venv
source venv/bin/activate

# On Windows (PowerShell):
# python -m venv venv
# .\venv\Scripts\Activate.ps1

# Install dependencies
pip install -r requirements.txt

# Start FastAPI server
python app.py
```
*The backend starts at `http://localhost:8000`.*

#### Step 2: Start the Frontend (Terminal 2)
```bash
# Navigate to frontend directory
cd frontend

# Install node packages
npm install

# Start Vite development server
npm run dev
```
*Open `http://localhost:5173` in your web browser.*

---

### Option C: Windows Automated Launch

On Windows machines, double-click or run:
```cmd
run_main.bat
```

---

## 7. API Reference

### `GET /api/records`
Returns the list of available MIT-BIH Arrhythmia Database record IDs.

**Sample Response:**
```json
{
  "records": ["100", "101", "103", "105", "111", "119", "200", "212"]
}
```

### `POST /api/process`
Executes the Pan-Tompkins pipeline and arrhythmia diagnostic engine on a specific record.

**Request Payload:**
```json
{
  "record_id": "100",
  "window_size_ms": 150,
  "lowcut": 5.0,
  "highcut": 15.0
}
```

**Response Payload:**
```json
{
  "record_id": "100",
  "fs": 360,
  "stages": {
    "original": [...],
    "bandpass": [...],
    "derivative": [...],
    "squared": [...],
    "integrated": [...],
    "peaks_integrated": [342, 701],
    "peaks_original": [340, 698],
    "threshold": 0.42
  },
  "analysis": {
    "hr_bpm": 74.5,
    "rmssd_ms": 28.4,
    "sdnn_ms": 35.1,
    "abnormalities": ["Normal Sinus Rhythm"],
    "simulated_bp": "112/71 mmHg (Est.)",
    "rr_intervals_ms": [805.5, 810.0]
  }
}
```

---

## 8. In-Depth Discussion & Engineering Trade-offs

### Algorithmic Strengths
- **Computational Efficiency:** The Pan-Tompkins algorithm relies exclusively on finite impulse response (FIR) / infinite impulse response (IIR) filtering, integer-friendly differentiation, squaring, and moving-average convolutions. It delivers sub-millisecond execution times without needing heavy neural networks, making it ideal for battery-powered wearable Holter monitors and embedded microcontrollers.
- **Noise Rejection:** The tandem of bandpass filtering and window integration makes the detector remarkably resilient to respiratory wander and high-frequency muscle trembling.

### Known Limitations & Modern Alternatives
- **Morphological Variability:** In patients with severe bundle branch block (BBB) or premature ventricular contractions (PVCs), the QRS complex may be abnormally wide and biphasic. The fixed 150 ms integration window can split wide complexes into multi-peak outputs.
- **Fixed vs. Adaptive Thresholding:** The baseline threshold used in this implementation is computed across the 10-second window ($\mu + 0.5\sigma$). In clinical Holter environments with non-stationary background noise, Pan & Tompkins' original dual dual-threshold system (which dynamically updates separate signal peak `SPKI` and noise peak `NPKI` registers beat-by-beat) offers superior noise tracking.
- **Deep Learning Comparison:** While modern Transformer (e.g., 1D-CNN + BiLSTM) models achieve slightly higher F1-scores on complex multi-lead arrhythmia benchmarks, Pan-Tompkins remains the clinical baseline due to its full interpretability, deterministic behavior, and zero training overhead.

---

## 9. References

1. **Pan, J., & Tompkins, W. J.** (1985). *A Real-Time QRS Detection Algorithm*. IEEE Transactions on Biomedical Engineering, BME-32(3), 230–236.
2. **Moody, G. B., & Mark, R. G.** (2001). *The impact of the MIT-BIH Arrhythmia Database*. IEEE Engineering in Medicine and Biology Magazine, 20(3), 45–50.
3. **Goldberger, A. L., et al.** (2000). *PhysioBank, PhysioToolkit, and PhysioNet: Components of a new research resource for complex physiologic signals*. Circulation, 101(23), e215–e220.



## Project Developed by:
- Abid M Bari
- Shadman Shahriar Shuvo


## GitHub repo:
[bari4078/PanTompkinsQRSDetectionAlgorithm](https://github.com/bari4078/PanTompkinsQRSDetectionAlgorithm)

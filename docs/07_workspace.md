# 7. Interactive ECG Workspace

## Layout Architecture
[Current Codebase Implementation]

The application provides an interactive 3-column analysis environment designed for exploratory signal processing:

```text
┌───────────────────┬───────────────────────────────────┬─────────────────┐
│  LEFT SIDEBAR     │           CENTER COLUMN           │   RIGHT COLUMN  │
│                   │                                   │                 │
│  * Record Pick    │  * Top Metric Cards (HR, HRV)     │  * 3D Heart     │
│  * Filter Sliders │  * Algorithm Stages (5 tabs)      │    Conduction   │
│  * Playback       │  * ECG Plot & Playback Cursor     │    Visualizer   │
│    Controls       │  * Selected-Beat Evidence Card    │    (Fixed 580px)│
└───────────────────┴───────────────────────────────────┴─────────────────┘
```

---

## 1. Parameters Sidebar (Left Column)
[Current Codebase Implementation]

The left sidebar enables dynamic reconfiguration of detector parameters:

* **Record Selector**:
  Selects an ECG recording to process. The dropdown is populated dynamically via `GET /api/records` from records discovered in the application's data directory (such as MIT-BIH records 100, 101, 103, 105, 106, 115, 119, 200, 212, 222).
* **Moving Window Size (ms)**:
  Adjusts the integration window width ($50\text{ to }300\text{ ms}$, default $150\text{ ms}$). Decreasing the window sharpens rapid peaks; increasing it consolidates wide QRS complexes.
* **Filter Cutoff Frequencies**:
  * **Low-cut ($f_{\text{low}}$)**: Slider from $1.0\text{ to }10.0\text{ Hz}$ (default $5.0\text{ Hz}$).
  * **High-cut ($f_{\text{high}}$)**: Slider from $10.0\text{ to }30.0\text{ Hz}$ (default $15.0\text{ Hz}$).
* **Apply & Process Button**:
  Sends a `POST /api/process` request to the backend with the configured parameters, instantly recomputing all five pipeline stages and delineation landmarks.

---

## 2. Playback Engine & Controls
[Current Codebase Implementation]

Located below the parameter controls, the playback engine simulates continuous clinical ECG playback:

* **Play / Pause / Stop**: Toggles real-time simulated playback driven by a `requestAnimationFrame` (RAF) timing loop.
* **Speed Selection**: Plays at $0.25\times$, $0.5\times$, $1.0\times$, $1.5\times$, or $2.0\times$ speed.
* **Micro-Navigation**:
  * **Step Sample (← / →)**: Advances or rewinds playback by a single discrete sample ($\Delta t = 1/f_s$).
  * **Step Beat (⏮ / ⏭)**: Jumps directly to the previous or next detected QRS complex.
* **Scrubber Bar**: Click and drag to scrub to any point across the signal duration.

---

## 3. Top Metric Cards
[Current Codebase Implementation]

Mounted above the central waveform, four real-time cards summarize cardiovascular statistics:

1. **Heart Rate (BPM)**: Mean heart rate computed from detected RR intervals.
2. **HRV (SDNN)**: Standard deviation of normal-to-normal intervals in milliseconds.
3. **Rhythm Status**: Real-time classification based on instantaneous heart rate (e.g., *Normal Sinus Rhythm*, *Sinus Tachycardia* $>100\text{ BPM}$, *Sinus Bradycardia* $<60\text{ BPM}$, or *Irregular / Arrhythmia*).
4. **Detection Audit**: Live counts of Total Detected Beats, Search-back Recovered Beats, and Rejected T-waves.

---

## 4. Algorithm Stages Card
[Current Codebase Implementation]

The center stage switcher lets users inspect the transformation of the signal through each phase of the Pan-Tompkins pipeline:

* **`Original`**: Raw lead voltage recording. Shows QRS delineation overlays when enabled.
* **`Bandpass`**: Noise-filtered ECG ($5\text{–}15\text{ Hz}$).
* **`Derivative`**: First-difference slope extraction showing high steepness around QRS complexes.
* **`Squared`**: Non-linearly amplified positive slope energy ($x^2$).
* **`Integrated`**: Smooth energy pulse envelope ($\sim 150\text{ ms}$ moving average).

### Educational Explanation Panel
Below the tabs, an educational card outlines:
* What the active signal represents.
* Why Pan-Tompkins uses it.
* What specific information it contributes to detection.
* Sampling rate ($f_s$), window width in samples, and processing group delay.

---

## 5. Diagnostic Overlays
[Current Codebase Implementation]

Five toggle buttons allow users to inspect the detector's internal decision logic without cluttering the display:

* **Refractory Blanking (200 ms)**: Shaded translucent red zones following each accepted beat where detection is blanked.
* **Search-Back Detections**: Prominent amber diamond markers labeled `"Search-back"` highlighting beats recovered via secondary thresholds.
* **Rejected T-Waves**: Hollow purple markers with tooltips indicating candidates discarded due to low derivative slope.
* **Adaptive Thresholds**: Displays running threshold lines ($TH_{I1}, TH_{I2}$ or $TH_{F1}, TH_{F2}$) over the Integrated or Bandpass signals.
* **QRS Delineation**: Shaded bounding box with individual $Q, R, S$, onset, and offset landmarks on the Original stage.

---

## 6. ECG Waveform & Playback Cursor
[Current Codebase Implementation]

The ECG waveform is rendered using a memoized Plotly component (`ECGPlot.jsx`) that isolates the heavy canvas from playback ticks:
* **Interactive Tools**: Full panning, box zoom, and double-click autoscale.
* **Drift-Free Playback Cursor**: An isolated red vertical line (`PlaybackCursor.jsx`) dynamically tracks Plotly's internal SVG `<rect class="plotbg">` bounds. This ensures sub-pixel synchronization during window resizing, browser zooming, or axis scale changes without hard-coded pixel margins.

---

## 7. Selected-Beat Evidence Card
[Current Codebase Implementation]

Clicking any heartbeat in the waveform or using the navigation buttons (`Prev Beat` / `Next Beat`) opens a comprehensive audit card displaying:
* **Fiducial Timestamp & Sample Index**: Exact occurrence in seconds and discrete samples.
* **Morphological Landmarks**: Individual $Q, R, S$ times, voltages, and calculated QRS duration ($t_{\text{offset}} - t_{\text{onset}}$).
* **Pan-Tompkins Detection Evidence**:
  * Signal Peak Level ($PEAKI, PEAKF$).
  * Active Thresholds at time of detection ($TH_{I1}, TH_{F1}$).
  * Local derivative slope.
  * Detection method (`Normal` vs. `Search-back`).

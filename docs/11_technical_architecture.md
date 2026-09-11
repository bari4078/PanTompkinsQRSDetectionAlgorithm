# 11. Technical Architecture

## Full-Stack System Architecture
[Current Codebase Implementation]

The application follows a decoupled client-server architecture with a high-performance Python FastAPI scientific computing backend and a modern React 19 frontend:

```text
┌────────────────────────────────────────────────────────────────────────┐
│                        FRONTEND (React 19 / Vite)                      │
│                                                                        │
│  App.jsx (View Router: 'workspace' | 'evaluation' | 'docs')           │
│    ├── ECGPlot.jsx (Memoized Plotly Waveform Canvas)                   │
│    ├── PlaybackCursor.jsx (DOM-Driven Sub-Pixel Cursor)               │
│    ├── HeartModel.jsx (Three.js 3D Conduction Visualizer)              │
│    ├── EvaluationPanel.jsx (ANSI/AAMI EC57 Benchmark)                  │
│    └── DocumentationPanel.jsx (Interactive Technical Manual)           │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ HTTP REST (JSON)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        BACKEND (FastAPI / Python 3)                    │
│                                                                        │
│  app.py (REST API Controller & CORS Middleware)                        │
│    ├── data_loader.py (Dynamic WFDB Record Discovery & Loading)        │
│    ├── pan_tompkins/ (Filters & Detector Strategy Pattern)             │
│    │     ├── filters.py (Bandpass, Derivative, Squaring, Integration) │
│    │     └── detector.py (Adaptive Thresholding & Search-Back)        │
│    ├── delineation/ (Morphological Landmark Delineation Layer)         │
│    │     └── qrs_delineator.py (Isoelectric Baseline, Q, R, S, J-pt)  │
│    ├── evaluation/ (ANSI/AAMI EC57 Bipartite Matching Engine)          │
│    │     └── evaluator.py (Hungarian Algorithm, Micro/Macro Stats)     │
│    └── analysis.py (Heart Rate & SDNN HRV Statistics)                  │
└────────────────────────────────────────────────────────────────────────┘
```

---

## Backend Modules & Responsibilities
[Current Codebase Implementation]

The backend codebase is organized modularly under `backend/`:

### 1. `backend/app.py`
The FastAPI application entry point:
* Configures Cross-Origin Resource Sharing (CORS) middleware.
* Defines Pydantic validation models: `ProcessRequest` and `EvaluationRequest`.
* Serves primary API routes and backward-compatible root aliases.

### 2. `backend/data_loader.py`
Manages physiological data access:
* **Dynamic Record Discovery**: Inspects the local `mitbih/` dataset directory and dynamically returns available record identifiers.
* **WFDB Integration**: Reads raw signal arrays and reference annotation (`.atr`) files via PhysioNet's `wfdb` library.

### 3. `backend/pan_tompkins/filters.py`
Implements the Strategy Pattern for digital signal filtering:
* `BandpassFilter`: 1st-order Butterworth filter ($5\text{–}15\text{ Hz}$).
* `DerivativeFilter`: 5-point differentiator kernel $h_d = [1/8, 2/8, 0, -2/8, -1/8] \times f_s$.
* `SquaringFilter`: Non-linear pointwise operator $x[n]^2$.
* `MovingWindowIntegration`: Convolution with uniform rectangular window of width $N$.

### 4. `backend/pan_tompkins/detector.py`
The core 1985 Pan-Tompkins detection and decision engine:
* Tracks signal peaks ($SPKI, SPKF$) and noise peaks ($NPKI, NPKF$).
* Enforces dual thresholds ($TH_{I1}, TH_{I2}$ and $TH_{F1}, TH_{F2}$).
* Executes $200\text{ ms}$ physiological refractory blanking.
* Classifies T-waves in the $200\text{–}360\text{ ms}$ window via derivative slope testing.
* Performs search-back when interval exceeds $1.66 \times RR_{\text{avg2}}$.
* Maps integrated pulse peaks back to raw ECG fiducials (`peaks_original`).

### 5. `backend/delineation/qrs_delineator.py`
Application-specific downstream morphology analysis:
* Estimates pre-QRS PR-segment isoelectric baseline.
* Performs constrained local extrema search.
* Detects true QS complexes ($r\_index = \text{null}$).
* Localizes $Q$ and $S$ deflections relative to baseline.
* Detects QRS onset and offset (J-point) using multi-sample persistent slope drop ($0.12 \times \text{max slope}$ across 3 consecutive samples).

### 6. `backend/evaluation/evaluator.py`
Rigorous benchmarking module:
* Solves deterministic minimum-cost bipartite matching via `scipy.optimize.linear_sum_assignment`.
* Filters standard ANSI/AAMI EC57 beat codes against non-beat markers.
* Computes micro and macro aggregates ($TP, FP, FN, Se, PPV, DER$).
* Computes latency distribution statistics (mean, median, max, std).
* Maintains strict isolation of historical 1985 paper metrics.

### 7. `backend/analysis.py`
Calculates clinical summary metrics:
* Heart rate ($HR = 60 / \overline{RR}$).
* Heart rate variability ($\text{SDNN}$).
* Rhythm status classification.

---

## API Endpoints & Request Schemas
[Current Codebase Implementation]

The backend exposes the following REST API endpoints:

### 1. `GET /api/records` (Alias: `GET /records`)
Returns a list of dynamically discovered MIT-BIH record IDs.
```json
{
  "records": ["100", "101", "103", "105", "106", "115", "119", "200", "212", "222"]
}
```

### 2. `POST /api/process` (Alias: `POST /process`)
Processes a single ECG record through the complete Pan-Tompkins pipeline and delineation layer.
* **Request Body**:
  ```json
  {
    "record_id": "100",
    "window_size_ms": 150,
    "lowcut": 5.0,
    "highcut": 15.0
  }
  ```
* **Response Schema**:
  ```json
  {
    "fs": 360,
    "stages": {
      "original": [0.05, 0.08, ...],
      "bandpass": [-0.01, 0.02, ...],
      "derivative": [0.12, 0.45, ...],
      "squared": [0.01, 0.20, ...],
      "integrated": [0.02, 0.08, ...],
      "peaks_original": [77, 370, 663, ...],
      "detected_peaks": [77, 370, 663, ...],
      "searchback": [],
      "rejected_t_waves": [145, 450],
      "refractory_intervals": [[77, 149], [370, 442], ...]
    },
    "analysis": {
      "hr_bpm": 74.5,
      "sdnn_ms": 38.2,
      "abnormalities": "Normal Sinus Rhythm"
    },
    "delineation": [
      {
        "beat_index": 0,
        "pt_qrs_index": 77,
        "r_index": 77,
        "q_index": 71,
        "s_index": 86,
        "qrs_onset_index": 65,
        "qrs_offset_index": 95,
        "qrs_duration_ms": 83.3
      }
    ]
  }
  ```

### 3. `POST /api/evaluate`
Executes ANSI/AAMI EC57 benchmarking against reference annotations.
* **Request Body**:
  ```json
  {
    "record_ids": ["100", "119"],
    "tolerance_ms": 150.0,
    "duration_sec": 60.0,
    "window_size_ms": 150,
    "lowcut": 5.0,
    "highcut": 15.0
  }
  ```
* **Response**: Contains micro/macro summary metrics, per-record evaluation results, event-by-event classification logs, and historical paper reference metadata.

---

## Frontend Component Architecture
[Current Codebase Implementation]

The frontend is built with React 19 and Vite 8:

* **State Isolation & Memoization**:
  * `ECGPlot.jsx` is wrapped in `React.memo` with a custom equality check, preventing Plotly from re-rendering during high-frequency playback ticks.
  * `PlaybackCursor.jsx` runs independently of Plotly canvas redraws, using native DOM `MutationObserver` and `ResizeObserver` on Plotly's `.plotbg` rect to maintain sub-pixel alignment.
* **Non-Destructive View Routing**:
  * In `App.jsx`, `viewMode` toggles between `'workspace'`, `'evaluation'`, and `'docs'`.
  * The Workspace DOM and 3D WebGL Canvas remain mounted (`display: none`), while Three.js render loops (`frameloop="never"`) and playback timers are suspended to preserve GPU/CPU resources until returning.

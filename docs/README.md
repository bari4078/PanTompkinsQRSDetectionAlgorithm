# Pan-Tompkins ECG Application Documentation

Welcome to the comprehensive technical documentation for the Pan-Tompkins ECG processing, morphology delineation, 3D cardiac conduction, and MIT-BIH benchmark application.

This documentation serves as both an interactive in-app guide and a complete technical reference manual.

---

## Documentation Curriculum

| Chapter | Title | File | Category | Description |
|---|---|---|---|---|
| **01** | [Introduction](01_introduction.md) | `01_introduction.md` | Overview | Application capabilities, ECG analysis overview, educational scope notice. |
| **02** | [ECG Fundamentals](02_ecg_fundamentals.md) | `02_ecg_fundamentals.md` | Electrophysiology | Cardiac cycle waveform anatomy, P-QRS-T components, RR intervals, heart rate, and HRV. |
| **03** | [What Is the Pan-Tompkins Algorithm?](03_pan_tompkins_algorithm.md) | `03_pan_tompkins_algorithm.md` | Theory | Historical origins (1985), noise challenges, and why adaptive dual-threshold detection is required. |
| **04** | [Pan-Tompkins Processing Pipeline](04_processing_pipeline.md) | `04_processing_pipeline.md` | Signal Processing | The five mathematical transformation stages: bandpass, derivative, squaring, integration, and peak mapping. |
| **05** | [Adaptive Decision Logic](05_adaptive_detection.md) | `05_adaptive_detection.md` | Algorithm | Signal/noise peak tracking ($SPK/NPK$), dual thresholds, refractory blanking, T-wave rejection, and search-back. |
| **06** | [QRS Detection vs. QRS Delineation](06_qrs_delineation.md) | `06_qrs_delineation.md` | Morphology | The boundary between detection fiducials and downstream morphological heuristics ($Q, R, S$, onset, offset). |
| **07** | [Interactive ECG Workspace](07_workspace.md) | `07_workspace.md` | User Interface | Using the parameter sidebar, real-time playback controls, diagnostic overlays, and selected-beat audit card. |
| **08** | [3D Cardiac Conduction Visualization](08_cardiac_conduction.md) | `08_cardiac_conduction.md` | Anatomy & 3D | The electrical conduction pathway (SA $\rightarrow$ AV $\rightarrow$ His $\rightarrow$ Purkinje) synchronized with cardiac phases. |
| **09** | [Evaluation & MIT-BIH Benchmark](09_evaluation.md) | `09_evaluation.md` | Validation | MIT-BIH database, ANSI/AAMI EC57 beat codes, deterministic bipartite matching, and metrics reporting. |
| **10** | [Limitations & Important Notes](10_limitations.md) | `10_limitations.md` | Boundary Conditions | Non-clinical scope, lead configuration assumptions, and performance distinctions. |
| **11** | [Technical Architecture](11_technical_architecture.md) | `11_technical_architecture.md` | Engineering | Full-stack codebase blueprint, FastAPI backend, React 19 frontend, and REST API schemas. |

---

## Architectural Notes
* **Single Source of Truth**: The Markdown files in this directory (`docs/*.md`) serve as the canonical documentation source. The frontend imports these files directly using Vite build-time assets.
* **Excluded File**: `3_Python_Syntax_For_Novices.md` is an educational tutorial preserved in this repository for historical reference, but is deliberately excluded from the application's documentation UI and navigation.

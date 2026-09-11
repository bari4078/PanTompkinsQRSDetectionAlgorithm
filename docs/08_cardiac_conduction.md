# 8. 3D Cardiac Conduction Visualization

## Educational Purpose & Scope
[Application-Specific Design Choice]

The right-hand column of the workspace hosts a real-time interactive 3D model of the human heart built with **Three.js** and **React Three Fiber**.

> [!IMPORTANT]
> **Educational Aid Disclaimer**
> The 3D heart visualization is strictly an anatomical and physiological **educational visualization**.
> * It illustrates how electrical conduction propagates through cardiac tissue in synchrony with recorded ECG waves.
> * The 3D model **does not** perform ECG signal processing, peak detection, or clinical diagnostic simulation.

---

## The Cardiac Conduction System
[Cardiovascular Electrophysiology]

The 3D model highlights the specialized electrical conduction pathway that coordinates heart muscle contraction during every cardiac cycle:

```text
Sinoatrial (SA) Node (Pacemaker)
       │
       ▼ [Atrial Depolarization → P Wave]
Atrioventricular (AV) Node (Conduction Delay)
       │
       ▼ [PR Segment Conduction]
Bundle of His (Septal Penetration)
       │
       ▼
Left & Right Bundle Branches (Interventricular Septum)
       │
       ▼
Purkinje Fiber Network (Ventricular Myocardium → QRS Complex)
```

### 1. Sinoatrial (SA) Node
Located in the superior posterolateral wall of the right atrium, the SA node contains self-excitatory pacemaker cells that spontaneously generate electrical action potentials at the intrinsic sinus rate ($60\text{–}100\text{ BPM}$).

### 2. Atrioventricular (AV) Node
Located at the base of the interatrial septum, the AV node acts as an electrical gatekeeper between atria and ventricles. It introduces a physiological delay of approximately $0.09\text{ to }0.12\text{ seconds}$ (represented by the PR segment on the ECG), allowing the atria to fully pump their blood volume into the ventricles before ventricular contraction begins.

### 3. Bundle of His (AV Bundle)
A tract of specialized conducting fibers that penetrates the fibrous cardiac skeleton, bridging the electrical gap between atria and ventricles.

### 4. Right and Left Bundle Branches
In the interventricular septum, the conduction system bifurcates into the Right Bundle Branch and Left Bundle Branch (which further subdivides into anterior and posterior fascicles), transmitting impulses rapidly toward the heart apex.

### 5. Purkinje Fiber Network
An extensive network of large-diameter, high-velocity conduction fibers spreading across the subendocardium of both ventricles. They distribute the electrical wavefront almost instantaneously across ventricular muscle cells, producing the synchronized, powerful contraction reflected by the **QRS complex**.

---

## Playback Synchronization: Cardiac Phase Engine
[Current Codebase Implementation]

During playback, the application's cardiac phase engine (`frontend/src/playback/cardiacPhase.js`) determines the active physiological phase of the heart based on the current timestamp relative to adjacent QRS fiducials:

| Cardiac Phase | ECG Correlate | Conduction State | 3D Visualization Effect |
|---|---|---|---|
| **Atrial Systole** | P-Wave | SA node activation propagating across atria | Subtle atrial contraction; conduction pathway glow starts at SA node. |
| **Ventricular Systole** | QRS Complex through T-Wave | AV nodal release, His-Purkinje firing, ventricular contraction | Rapid ventricular contraction, followed by recovery glow during the T-wave. |
| **Diastole** | TP Segment | Electrical rest; ventricular relaxation and chamber refilling | Chambers expand to baseline; quiescent electrical state. |

---

## Interactive Controls & Performance Preservation
[Current Codebase Implementation]

* **3D Interaction**: Users can click and drag to rotate the heart model, scroll to zoom in/out, and right-click to pan using OrbitControls.
* **Stable Dimensions**: The container is locked to a fixed height of `580px` (`maxHeight: calc(100vh - 2.5rem)`), ensuring that changes in the center ECG layout do not stretch the heart or distort camera perspective.
* **GPU Resource Preservation**: When navigating away from the Workspace into the **Documentation** or **Evaluation Benchmark** views, the application automatically suspends the Three.js animation render loop (`frameloop="never"`), completely halting unnecessary background WebGL GPU rendering while preserving 3D state in memory.

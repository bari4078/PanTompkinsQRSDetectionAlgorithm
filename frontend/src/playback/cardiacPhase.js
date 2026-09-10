/**
 * Evaluates the cardiac conduction phase based on relative time to an R-peak.
 */

import { resolveBeat } from './beatResolver';

// Educational visualization timing.
// These windows approximate conduction phases relative to detected R-peaks.
// They are NOT clinically derived ECG interval boundaries.
// The animation illustrates the relationship between ECG morphology and
// the cardiac conduction system for educational purposes only.

export const CARDIAC_PHASES = {
  atrial_activation:      { start: -0.20, end: -0.12 },
  av_delay:               { start: -0.12, end: -0.04 },
  ventricular_conduction: { start: -0.04, end:  0.06 },
  repolarization:         { start:  0.10, end:  0.35 },
  // Note: gap between +0.06 and +0.10 maps to diastole (isoelectric ST segment)
};

/**
 * resolveCardiacPhase(currentSampleIndex, rPeaks, fs)
 * Uses beatResolver internally.
 * @returns {{ phase: string, progress: number, beatIndex: number|null, prevPeakIndex: number|null, nextPeakIndex: number|null }}
 *   phase: 'atrial_activation' | 'av_delay' | 'ventricular_conduction' | 'repolarization' | 'diastole'
 *   progress: 0 to 1 within that phase (0 = start, 1 = end)
 */
export function resolveCardiacPhase(currentSampleIndex, rPeaks, fs) {
  // No peaks → no cardiac cycle to reference
  if (!rPeaks || rPeaks.length === 0) {
    return { phase: 'diastole', progress: 0, beatIndex: null, prevPeakIndex: null, nextPeakIndex: null };
  }

  const beatInfo = resolveBeat(currentSampleIndex, rPeaks, fs);
  const { relativeTimeSec, prevPeakIndex, nextPeakIndex, beatIndex } = beatInfo;

  let phaseName = 'diastole';
  let progress = 0;

  for (const [key, window] of Object.entries(CARDIAC_PHASES)) {
    if (relativeTimeSec >= window.start && relativeTimeSec <= window.end) {
      phaseName = key;
      progress = (relativeTimeSec - window.start) / (window.end - window.start);
      break;
    }
  }

  return {
    phase: phaseName,
    progress,
    beatIndex,
    prevPeakIndex,
    nextPeakIndex
  };
}

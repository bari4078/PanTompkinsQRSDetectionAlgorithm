"""
QRS Delineation / Morphological Landmark Estimation
===================================================

IMPORTANT PROVENANCE AND ARCHITECTURAL SPECIFICATION:
------------------------------------------------------
This module implements a dedicated post-processing morphology-analysis layer
operating downstream of the Pan-Tompkins QRS detector.

The original 1985 Pan-Tompkins algorithm ("A Real-Time QRS Detection Algorithm",
IEEE Trans. Biomed. Eng., BME-32(3):230-236, 1985) detected the QRS complex as
an integrated whole and provided a single fiducial detection point. It did NOT
directly detect individual Q, R, and S waves, nor did it estimate QRS onset
or offset (J-point).

All delineation algorithms, thresholds, and parameters implemented in this module—
including:
  - 0.12 * max QRS slope threshold for onset/offset convergence,
  - 3-consecutive-sample multi-sample persistence condition,
  - PR-segment isoelectric baseline estimation windows, and
  - Local morphological extrema search constraints
are APPLICATION-SPECIFIC DELINEATION HEURISTICS. They are NOT parameters from the
1985 Pan-Tompkins paper and must NOT be attributed to Pan and Tompkins.

Pipeline Architecture:
  pt_qrs_index (Pan-Tompkins fiducial, strictly immutable)
       │
       ▼
  Local isoelectric baseline estimation (pre-QRS PR segment)
       │
       ▼
  Morphology classification (upright, biphasic, or QS complex)
       │
       ▼
  R-peak localization (positive peak near fiducial; null for true QS)
       │
       ├──► Constrained backward search for Q (true nadir below baseline; null if absent)
       ├──► Constrained forward search for S (true nadir below baseline; null if absent)
       ├──► Multi-sample persistent backward search for QRS onset
       └──► Multi-sample persistent forward search for QRS offset (J-point)
"""

from typing import List, Dict, Any, Optional
import numpy as np


class QRSDelineator:
    """
    Morphology-robust QRS delineator for estimating individual waveform landmarks
    (Q, R, S, QRS onset, and QRS offset) around Pan-Tompkins detected beats.
    """

    def __init__(
        self,
        r_search_window_ms: float = 45.0,
        q_search_window_ms: float = 80.0,
        s_search_window_ms: float = 120.0,
        onset_search_window_ms: float = 90.0,
        offset_search_window_ms: float = 140.0,
        iso_pre_start_ms: float = 120.0,
        iso_pre_end_ms: float = 60.0,
        slope_threshold_ratio: float = 0.12,
        persistence_samples: int = 3,
    ):
        """
        Initialize delineation parameters.

        NOTE: These parameters are application-specific morphology heuristics
        and are NOT part of the 1985 Pan-Tompkins algorithm.
        """
        self.r_search_window_ms = r_search_window_ms
        self.q_search_window_ms = q_search_window_ms
        self.s_search_window_ms = s_search_window_ms
        self.onset_search_window_ms = onset_search_window_ms
        self.offset_search_window_ms = offset_search_window_ms
        self.iso_pre_start_ms = iso_pre_start_ms
        self.iso_pre_end_ms = iso_pre_end_ms
        self.slope_threshold_ratio = slope_threshold_ratio
        self.persistence_samples = persistence_samples

    def delineate_beats(
        self,
        signal: np.ndarray,
        fs: float,
        qrs_indices: List[int],
        detection_metadata: Optional[Dict[str, Any]] = None,
    ) -> List[Dict[str, Any]]:
        """
        Delineates Q, R, S, QRS onset, and QRS offset for every detected beat.

        Args:
            signal: 1D numpy array containing original ECG samples.
            fs: Sampling frequency in Hz.
            qrs_indices: Pan-Tompkins detected QRS sample indices.
            detection_metadata: Optional dictionary with Pan-Tompkins detection metadata.

        Returns:
            List of dictionaries containing landmark indices, times, durations,
            and evidence structures.
        """
        signal = np.asarray(signal, dtype=np.float64)
        n_samples = len(signal)
        delineated_beats: List[Dict[str, Any]] = []

        if n_samples == 0 or len(qrs_indices) == 0:
            return delineated_beats

        # Precompute derivative for slope analysis
        if n_samples > 1:
            diff_sig = np.diff(signal)
        else:
            diff_sig = np.zeros(1)

        # Scale windows to samples
        r_win = max(2, int((self.r_search_window_ms / 1000.0) * fs))
        q_win = max(2, int((self.q_search_window_ms / 1000.0) * fs))
        s_win = max(2, int((self.s_search_window_ms / 1000.0) * fs))
        onset_win = max(2, int((self.onset_search_window_ms / 1000.0) * fs))
        offset_win = max(2, int((self.offset_search_window_ms / 1000.0) * fs))
        iso_start_offset = int((self.iso_pre_start_ms / 1000.0) * fs)
        iso_end_offset = int((self.iso_pre_end_ms / 1000.0) * fs)

        for beat_idx, pt_fiducial in enumerate(qrs_indices):
            pt_qrs_index = int(pt_fiducial)

            # -------------------------------------------------------------
            # 1. Local Isoelectric Baseline Estimation (PR segment)
            # -------------------------------------------------------------
            iso_start = max(0, pt_qrs_index - iso_start_offset)
            iso_end = max(0, pt_qrs_index - iso_end_offset)
            if iso_end > iso_start and (iso_end - iso_start) >= 2:
                iso_window = signal[iso_start:iso_end]
                iso_baseline = float(np.median(iso_window))
                iso_std = float(np.std(iso_window))
            else:
                iso_baseline = float(signal[pt_qrs_index])
                iso_std = 0.01

            # Minimum noise margin
            noise_margin = max(2.5 * iso_std, 0.02)

            # -------------------------------------------------------------
            # 2. Local Morphological Extrema & R-Peak Localization
            # -------------------------------------------------------------
            w_r_start = max(0, pt_qrs_index - r_win)
            w_r_end = min(n_samples, pt_qrs_index + r_win + 1)

            # Find all local maxima and local minima in the fiducial window
            local_maxima = []
            local_minima = []
            for k in range(w_r_start + 1, w_r_end - 1):
                if signal[k] >= signal[k - 1] and signal[k] >= signal[k + 1]:
                    local_maxima.append(k)
                if signal[k] <= signal[k - 1] and signal[k] <= signal[k + 1]:
                    local_minima.append(k)

            # Determine dominant deflection
            all_extrema = local_maxima + local_minima
            if all_extrema:
                dominant_idx = int(max(all_extrema, key=lambda idx: abs(signal[idx] - iso_baseline)))
            else:
                dominant_idx = pt_qrs_index

            # Identify R candidate: must be a local maximum with positive deflection above baseline
            pos_peaks = [
                m for m in local_maxima
                if (signal[m] - iso_baseline) > noise_margin
            ]

            r_index: Optional[int] = None
            r_evidence: Dict[str, Any] = {}

            if pos_peaks:
                # Select the positive peak nearest to the Pan-Tompkins fiducial
                r_cand = min(pos_peaks, key=lambda m: abs(m - pt_qrs_index))
                r_index = int(r_cand)
                r_val = float(signal[r_index])
                r_prominence = float(r_val - iso_baseline)
                r_evidence = {
                    "found": True,
                    "peak_val": round(r_val, 4),
                    "prominence_above_iso": round(r_prominence, 4),
                    "offset_from_pt_ms": round((r_index - pt_qrs_index) / fs * 1000.0, 2),
                }
            else:
                # No significant positive peak exists -> true QS or inverted complex
                # In accordance with specification: do NOT assign negative nadir to r_index
                r_index = None
                r_evidence = {
                    "found": False,
                    "reason": "no_positive_peak_above_baseline",
                    "morphology": "qs_complex_or_inverted",
                }

            # Classify dominant deflection type
            pos_max_val = max([signal[m] - iso_baseline for m in local_maxima], default=0.0)
            neg_min_val = max([iso_baseline - signal[m] for m in local_minima], default=0.0)

            if pos_max_val > 0 and neg_min_val > 0:
                ratio = pos_max_val / max(neg_min_val, 1e-6)
                if 0.65 <= ratio <= 1.55:
                    dom_type = "biphasic"
                elif pos_max_val > neg_min_val:
                    dom_type = "positive"
                else:
                    dom_type = "negative"
            elif pos_max_val > 0:
                dom_type = "positive"
            else:
                dom_type = "negative"

            # -------------------------------------------------------------
            # 3. Constrained Q-Point Search (Must precede R)
            # -------------------------------------------------------------
            q_index: Optional[int] = None
            q_evidence: Dict[str, Any] = {}

            if r_index is not None:
                q_search_start = max(0, r_index - q_win)
                # Find local minima strictly preceding R
                q_candidates = []
                for k in range(r_index - 1, q_search_start, -1):
                    if signal[k] <= signal[k - 1] and signal[k] <= signal[k + 1]:
                        q_candidates.append(k)

                if q_candidates:
                    # Q must be a true negative deflection below isoelectric baseline
                    valid_q = None
                    for cand in q_candidates:
                        cand_val = signal[cand]
                        # Must dip below baseline
                        if (iso_baseline - cand_val) > max(0.5 * noise_margin, 0.01):
                            valid_q = cand
                            break

                    if valid_q is not None:
                        q_index = int(valid_q)
                        q_val = float(signal[q_index])
                        q_evidence = {
                            "found": True,
                            "nadir_val": round(q_val, 4),
                            "depth_below_iso": round(iso_baseline - q_val, 4),
                            "distance_to_r_ms": round((r_index - q_index) / fs * 1000.0, 2),
                        }
                    else:
                        q_evidence = {
                            "found": False,
                            "reason": "candidate_nadir_does_not_dip_below_baseline",
                        }
                else:
                    q_evidence = {
                        "found": False,
                        "reason": "no_pre_r_local_minimum",
                    }
            else:
                # QS complex has no distinct separate Q wave
                q_evidence = {
                    "found": False,
                    "reason": "qs_complex_lacks_separate_q",
                }

            # -------------------------------------------------------------
            # 4. Constrained S-Point Search (Must follow R)
            # -------------------------------------------------------------
            s_index: Optional[int] = None
            s_evidence: Dict[str, Any] = {}

            if r_index is not None:
                s_search_end = min(n_samples - 1, r_index + s_win)
                # Find local minima strictly following R
                s_candidates = []
                for k in range(r_index + 1, s_search_end):
                    if signal[k] <= signal[k - 1] and signal[k] <= signal[k + 1]:
                        s_candidates.append(k)

                if s_candidates:
                    # S must be a true negative deflection below isoelectric baseline
                    # Prioritize the deepest nadir following R downslope
                    valid_s = None
                    s_cands_sorted = sorted(s_candidates, key=lambda k: signal[k])
                    for cand in s_cands_sorted:
                        cand_val = signal[cand]
                        if (iso_baseline - cand_val) > max(0.5 * noise_margin, 0.01):
                            valid_s = cand
                            break

                    if valid_s is not None:
                        s_index = int(valid_s)
                        s_val = float(signal[s_index])
                        s_evidence = {
                            "found": True,
                            "nadir_val": round(s_val, 4),
                            "depth_below_iso": round(iso_baseline - s_val, 4),
                            "distance_from_r_ms": round((s_index - r_index) / fs * 1000.0, 2),
                        }
                    else:
                        s_evidence = {
                            "found": False,
                            "reason": "candidate_nadir_does_not_dip_below_baseline",
                        }
                else:
                    s_evidence = {
                        "found": False,
                        "reason": "no_post_r_local_minimum",
                    }
            else:
                # QS complex has no distinct separate S wave
                s_evidence = {
                    "found": False,
                    "reason": "qs_complex_lacks_separate_s",
                }

            # -------------------------------------------------------------
            # 5. QRS Slope Benchmark & Neighborhood Definition
            # -------------------------------------------------------------
            ref_center = r_index if r_index is not None else dominant_idx
            qrs_left = q_index if q_index is not None else max(0, ref_center - int(0.04 * fs))
            qrs_right = s_index if s_index is not None else min(n_samples - 1, ref_center + int(0.04 * fs))

            diff_left = max(0, qrs_left - 2)
            diff_right = min(len(diff_sig), qrs_right + 3)
            if diff_right > diff_left:
                max_qrs_slope = float(np.max(np.abs(diff_sig[diff_left:diff_right])))
            else:
                max_qrs_slope = 0.1

            slope_th = self.slope_threshold_ratio * max_qrs_slope
            qrs_span = abs(signal[dominant_idx] - iso_baseline)
            amp_tol = max(2.5 * iso_std, 0.08 * qrs_span)

            # -------------------------------------------------------------
            # 6. Persistent QRS Onset Estimation (Multi-Sample Convergence)
            # -------------------------------------------------------------
            onset_ref = q_index if q_index is not None else ref_center
            onset_bound = max(0, onset_ref - onset_win)
            qrs_onset_idx = onset_bound
            onset_found = False

            # Search backward from onset_ref toward PR segment
            for k in range(onset_ref - 1, onset_bound + self.persistence_samples - 1, -1):
                all_quiet = True
                for p_idx in range(k, k - self.persistence_samples, -1):
                    slope_k = abs(diff_sig[p_idx - 1]) if p_idx > 0 and (p_idx - 1) < len(diff_sig) else 0.0
                    dev_k = abs(signal[p_idx] - iso_baseline)
                    if slope_k > slope_th or dev_k > amp_tol:
                        all_quiet = False
                        break
                if all_quiet:
                    qrs_onset_idx = k
                    onset_found = True
                    break

            if not onset_found:
                pre_slopes = [
                    abs(diff_sig[p - 1]) if 0 < p < len(diff_sig) else 0.0
                    for p in range(onset_bound, onset_ref)
                ]
                if pre_slopes:
                    qrs_onset_idx = onset_bound + int(np.argmin(pre_slopes))
                else:
                    qrs_onset_idx = onset_bound

            onset_evidence = {
                "method": "persistent_baseline_convergence" if onset_found else "fallback_window_bound",
                "consecutive_samples": self.persistence_samples if onset_found else 1,
                "slope_threshold": round(slope_th, 4),
                "residual_to_baseline": round(abs(signal[qrs_onset_idx] - iso_baseline), 4),
            }

            # -------------------------------------------------------------
            # 7. Persistent QRS Offset Estimation (J-Point Multi-Sample Convergence)
            # -------------------------------------------------------------
            offset_ref = s_index if s_index is not None else ref_center
            offset_bound = min(n_samples - 1, offset_ref + offset_win)
            qrs_offset_idx = offset_bound
            offset_found = False

            # Search forward from offset_ref toward ST segment
            search_start = offset_ref + 1
            for k in range(search_start, offset_bound - self.persistence_samples + 1):
                all_quiet = True
                for p_idx in range(k, k + self.persistence_samples):
                    slope_k = abs(diff_sig[p_idx]) if p_idx < len(diff_sig) else 0.0
                    dev_k = abs(signal[p_idx] - iso_baseline)
                    if slope_k > slope_th and dev_k > amp_tol:
                        all_quiet = False
                        break
                if all_quiet:
                    qrs_offset_idx = k
                    offset_found = True
                    break

            if not offset_found:
                post_slopes = [
                    abs(diff_sig[p]) if p < len(diff_sig) else 0.0
                    for p in range(search_start, offset_bound)
                ]
                if post_slopes:
                    qrs_offset_idx = search_start + int(np.argmin(post_slopes))
                else:
                    qrs_offset_idx = offset_bound

            # Strict order guarantee
            if qrs_offset_idx <= qrs_onset_idx:
                qrs_offset_idx = min(n_samples - 1, qrs_onset_idx + max(1, int(0.04 * fs)))

            offset_evidence = {
                "method": "persistent_st_convergence" if offset_found else "fallback_window_bound",
                "consecutive_samples": self.persistence_samples if offset_found else 1,
                "slope_threshold": round(slope_th, 4),
                "residual_to_baseline": round(abs(signal[qrs_offset_idx] - iso_baseline), 4),
            }

            # -------------------------------------------------------------
            # 8. Time & Duration Calculations
            # -------------------------------------------------------------
            q_time = round(q_index / fs, 4) if q_index is not None else None
            r_time = round(r_index / fs, 4) if r_index is not None else None
            s_time = round(s_index / fs, 4) if s_index is not None else None
            onset_time = round(qrs_onset_idx / fs, 4)
            offset_time = round(qrs_offset_idx / fs, 4)

            qrs_duration_ms = round((qrs_offset_idx - qrs_onset_idx) / fs * 1000.0, 2)
            q_to_r_ms = round((r_index - q_index) / fs * 1000.0, 2) if (q_index is not None and r_index is not None) else None
            r_to_s_ms = round((s_index - r_index) / fs * 1000.0, 2) if (s_index is not None and r_index is not None) else None

            # -------------------------------------------------------------
            # 9. Link Pan-Tompkins Detection Evidence (if available)
            # -------------------------------------------------------------
            det_evidence: Dict[str, Any] = {}
            if detection_metadata:
                det_method = "normal"
                if "detection_method" in detection_metadata and beat_idx < len(detection_metadata["detection_method"]):
                    det_method = detection_metadata["detection_method"][beat_idx]
                elif "searchback" in detection_metadata and pt_qrs_index in detection_metadata["searchback"]:
                    det_method = "searchback"

                det_evidence = {
                    "method": det_method,
                    "pt_fiducial_sample": pt_qrs_index,
                    "pt_fiducial_time": round(pt_qrs_index / fs, 4),
                }

                if "threshold_i1" in detection_metadata and pt_qrs_index < len(detection_metadata["threshold_i1"]):
                    det_evidence["threshold_i1"] = detection_metadata["threshold_i1"][pt_qrs_index]
                if "threshold_i2" in detection_metadata and pt_qrs_index < len(detection_metadata["threshold_i2"]):
                    det_evidence["threshold_i2"] = detection_metadata["threshold_i2"][pt_qrs_index]
                if "threshold_f1" in detection_metadata and pt_qrs_index < len(detection_metadata["threshold_f1"]):
                    det_evidence["threshold_f1"] = detection_metadata["threshold_f1"][pt_qrs_index]
                if "threshold_f2" in detection_metadata and pt_qrs_index < len(detection_metadata["threshold_f2"]):
                    det_evidence["threshold_f2"] = detection_metadata["threshold_f2"][pt_qrs_index]

                if "rr_intervals" in detection_metadata and beat_idx > 0 and (beat_idx - 1) < len(detection_metadata["rr_intervals"]):
                    det_evidence["rr_interval_ms"] = round(detection_metadata["rr_intervals"][beat_idx - 1] / fs * 1000.0, 1)

            # -------------------------------------------------------------
            # 10. Assemble Beat Delineation Record
            # -------------------------------------------------------------
            delineated_beat = {
                "beat_index": beat_idx,
                "pt_qrs_index": pt_qrs_index,
                "q_index": q_index,
                "r_index": r_index,
                "s_index": s_index,
                "qrs_onset_index": qrs_onset_idx,
                "qrs_offset_index": qrs_offset_idx,
                "dominant_deflection_index": dominant_idx,
                "dominant_deflection_type": dom_type,
                "q_time": q_time,
                "r_time": r_time,
                "s_time": s_time,
                "qrs_onset_time": onset_time,
                "qrs_offset_time": offset_time,
                "qrs_duration_ms": qrs_duration_ms,
                "q_to_r_ms": q_to_r_ms,
                "r_to_s_ms": r_to_s_ms,
                "isoelectric_baseline": round(iso_baseline, 4),
                "q_evidence": q_evidence,
                "r_evidence": r_evidence,
                "s_evidence": s_evidence,
                "onset_evidence": onset_evidence,
                "offset_evidence": offset_evidence,
                "detection_evidence": det_evidence,
            }

            delineated_beats.append(delineated_beat)

        return delineated_beats

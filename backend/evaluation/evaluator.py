import numpy as np
import os
from collections import defaultdict
from scipy.optimize import linear_sum_assignment

from pan_tompkins.detector import PanTompkinsDetector

# ANSI/AAMI EC57 Standard Beat Symbols
# Non-beat annotations (e.g. rhythm changes '+', artifact '~', comment '"', etc.)
# are excluded from QRS ground truth.
ANSI_AAMI_BEAT_SYMBOLS = {
    'N',  # Normal beat
    'L',  # Left bundle branch block beat
    'R',  # Right bundle branch block beat
    'B',  # Bundle branch block unspecified
    'A',  # Atrial premature beat
    'a',  # Aberrated atrial premature beat
    'J',  # Nodal (junctional) premature beat
    'S',  # Supraventricular premature or ectopic beat
    'V',  # Premature ventricular contraction
    'r',  # R-on-T premature ventricular contraction
    'F',  # Fusion of ventricular and normal beat
    'e',  # Atrial escape beat
    'j',  # Nodal (junctional) escape beat
    'n',  # Supraventricular escape beat
    'E',  # Ventricular escape beat
    '/',  # Paced beat
    'f',  # Fusion of paced and normal beat
    'Q',  # Unclassifiable beat
    '?',  # Beat not classified / learning
}

# Published 1985 Pan-Tompkins Historical Literature Benchmark
# Source: Pan, J., & Tompkins, W. J. (1985). "A Real-Time QRS Detection Algorithm".
# IEEE Transactions on Biomedical Engineering, BME-32(3), 230-236.
PAPER_REFERENCE = {
    "source_title": "A Real-Time QRS Detection Algorithm",
    "authors": "Jiapu Pan and Willis J. Tompkins",
    "citation": "IEEE Transactions on Biomedical Engineering, Vol. BME-32, No. 3, pp. 230-236, March 1985",
    "database": "MIT-BIH Arrhythmia Database (all 48 24-hr analog tape recordings)",
    "dataset": "MIT-BIH Arrhythmia Database (all 48 24-hr analog tape recordings)",
    "total_beats": 116137,
    "false_positives": 507,
    "false_negatives": 277,
    "true_positives_derived": 115860,  # 116,137 - 277
    "failure_rate_percent": 0.675,
    "sensitivity_percent": 99.30,
    "ppv_percent": 99.56,
    "ppv_label": "Published PPV (derived from paper's reported FP/FN counts)",
    "ppv_derivation_formula": "TP = 116,137 - 277 = 115,860; PPV = 115,860 / (115,860 + 507) ≈ 99.56%",
    "disclaimer": (
        "Historical Pan–Tompkins benchmark and this implementation are not necessarily directly comparable "
        "because implementation details, sampling rate, filtering, evaluated records, evaluation duration, "
        "annotation handling, and matching configuration may differ."
    ),
}


def match_detections_to_reference(ref_samples, det_samples, tol_samples, fs=360):
    """
    Deterministic, one-to-one minimum-cost bipartite matching between reference beat
    annotations and detected QRS locations.

    Guarantees:
      1. Each reference annotation is matched to at most one detection.
      2. Each detection is matched to at most one reference annotation.
      3. Only candidate pairs within configured +/- tolerance (|ref - det| <= tol_samples) are eligible.
      4. When multiple valid candidate matches exist, assignment minimizes total absolute temporal error.
      5. Ties are resolved deterministically via index-weighted penalty terms.

    Args:
        ref_samples (list/array): Sorted reference beat sample indices.
        det_samples (list/array): Sorted detected QRS sample indices.
        tol_samples (int): Matching tolerance window in samples (e.g. 150 ms * fs).
        fs (int): Sampling frequency in Hz.

    Returns:
        matched_pairs (list): List of tuples (ref_idx, det_idx, abs_distance_samples)
        fp_indices (list): Detection indices that were not matched (False Positives)
        fn_indices (list): Reference indices that were not matched (False Negatives)
        latency_stats (dict): Mean, median, max, and std of absolute latency in milliseconds
    """
    ref_arr = np.asarray(ref_samples, dtype=int)
    det_arr = np.asarray(det_samples, dtype=int)

    m = len(ref_arr)
    n = len(det_arr)

    empty_latency = {
        "mean_ms": 0.0,
        "median_ms": 0.0,
        "max_ms": 0.0,
        "std_ms": 0.0,
        "latencies_ms": []
    }

    if m == 0 and n == 0:
        return [], [], [], empty_latency
    if m == 0:
        return [], list(range(n)), [], empty_latency
    if n == 0:
        return [], [], list(range(m)), empty_latency

    # 1. Identify all eligible candidate pairs within temporal tolerance
    # Using searchsorted for fast window bounding
    candidate_edges = []
    for i, r in enumerate(ref_arr):
        left_bound = r - tol_samples
        right_bound = r + tol_samples
        start_j = np.searchsorted(det_arr, left_bound, side='left')
        end_j = np.searchsorted(det_arr, right_bound, side='right')
        for j in range(start_j, end_j):
            dist = abs(r - det_arr[j])
            if dist <= tol_samples:
                candidate_edges.append((i, j, dist))

    if not candidate_edges:
        return [], list(range(n)), list(range(m)), empty_latency

    # 2. Decompose bipartite graph into connected components
    ref_adj = defaultdict(list)
    det_adj = defaultdict(list)
    for i, j, dist in candidate_edges:
        ref_adj[i].append((j, dist))
        det_adj[j].append((i, dist))

    visited_ref = set()
    visited_det = set()
    matched_pairs = []

    for r_root in range(m):
        if r_root in visited_ref or r_root not in ref_adj:
            continue

        comp_refs = []
        comp_dets = []
        queue = [('ref', r_root)]
        visited_ref.add(r_root)

        while queue:
            kind, node = queue.pop(0)
            if kind == 'ref':
                comp_refs.append(node)
                for neighbor, _ in ref_adj[node]:
                    if neighbor not in visited_det:
                        visited_det.add(neighbor)
                        queue.append(('det', neighbor))
            else:
                comp_dets.append(node)
                for neighbor, _ in det_adj[node]:
                    if neighbor not in visited_ref:
                        visited_ref.add(neighbor)
                        queue.append(('ref', neighbor))

        comp_refs.sort()
        comp_dets.sort()

        # Build submatrix for this connected component
        C = np.full((len(comp_refs), len(comp_dets)), 1e9)
        for u, r_idx in enumerate(comp_refs):
            for v, d_idx in enumerate(comp_dets):
                dist = abs(ref_arr[r_idx] - det_arr[d_idx])
                if dist <= tol_samples:
                    # Deterministic tie-breaker: earliest ref index, then earliest det index
                    tie_breaker = (r_idx * 1e-6) + (d_idx * 1e-10)
                    C[u, v] = dist + tie_breaker

        # Solve minimum-cost assignment
        row_ind, col_ind = linear_sum_assignment(C)
        for u, v in zip(row_ind, col_ind):
            if C[u, v] < 1e8:  # valid edge within tolerance
                r_idx = comp_refs[u]
                d_idx = comp_dets[v]
                dist = abs(ref_arr[r_idx] - det_arr[d_idx])
                matched_pairs.append((r_idx, d_idx, dist))

    # Sort matched pairs deterministically by reference index
    matched_pairs.sort(key=lambda x: (x[0], x[1]))
    matched_refs = {x[0] for x in matched_pairs}
    matched_dets = {x[1] for x in matched_pairs}

    fp_indices = [j for j in range(n) if j not in matched_dets]
    fn_indices = [i for i in range(m) if i not in matched_refs]

    # Latency distribution in milliseconds: (det_sample - ref_sample) / fs * 1000
    latencies_signed_ms = [
        ((det_arr[d] - ref_arr[r]) / fs) * 1000.0 for r, d, _ in matched_pairs
    ]
    abs_latencies_ms = [abs(lat) for lat in latencies_signed_ms]

    if abs_latencies_ms:
        latency_stats = {
            "mean_ms": float(np.mean(abs_latencies_ms)),
            "median_ms": float(np.median(abs_latencies_ms)),
            "max_ms": float(np.max(abs_latencies_ms)),
            "std_ms": float(np.std(abs_latencies_ms)),
            "latencies_ms": latencies_signed_ms
        }
    else:
        latency_stats = empty_latency

    return matched_pairs, fp_indices, fn_indices, latency_stats


def evaluate_record(
    record_id,
    data_loader,
    tolerance_ms=150.0,
    duration_sec=60.0,
    window_size_ms=150,
    lowcut=5.0,
    highcut=15.0,
):
    """
    Evaluates Pan-Tompkins QRS detector on a single MIT-BIH record against ground-truth
    annotations under ANSI/AAMI EC57 standard matching.

    Strict boundary management:
      - Signal is padded by +2 seconds during detector processing to prevent digital filter
        group delay or moving-window integration edge artifacts.
      - Evaluation interval is strictly [0, duration_sec * fs).
      - Both reference beats and detected peaks are clipped strictly to [0, duration_sec * fs)
        before bipartite matching so no outside events enter TP/FP/FN.
      - If duration_sec is None or <= 0, full recording duration is evaluated.
    """
    # 1. Load data and annotations
    full_signal, fs, ann = data_loader.load_record_and_annotations(record_id)
    total_samples = len(full_signal)
    total_record_duration_sec = total_samples / fs

    if duration_sec is not None and duration_sec > 0:
        eval_duration_sec = min(float(duration_sec), total_record_duration_sec)
        eval_samples = int(eval_duration_sec * fs)
        # Pad by 2 seconds (or until end of signal) for filter stabilization
        proc_samples = min(total_samples, int((eval_duration_sec + 2.0) * fs))
        proc_signal = full_signal[:proc_samples]
    else:
        eval_duration_sec = total_record_duration_sec
        eval_samples = total_samples
        proc_signal = full_signal

    # 2. Run Pan-Tompkins detector as-is (strictly no ground-truth feedback / leakage)
    detector = PanTompkinsDetector(
        window_size_ms=window_size_ms,
        filter_lowcut=lowcut,
        filter_highcut=highcut
    )
    res = detector.process(proc_signal, fs)
    raw_detected_peaks = res['detected_peaks']

    # 3. Restrict detected peaks and reference annotations strictly to evaluated interval [0, eval_samples)
    det_peaks_eval = [int(p) for p in raw_detected_peaks if 0 <= p < eval_samples]

    ref_samples_all = ann.sample
    ref_symbols_all = ann.symbol

    ref_eval = [
        (int(s), sym)
        for s, sym in zip(ref_samples_all, ref_symbols_all)
        if 0 <= s < eval_samples and sym in ANSI_AAMI_BEAT_SYMBOLS
    ]

    ref_samples_eval = [s for s, _ in ref_eval]
    ref_symbols_eval = [sym for _, sym in ref_eval]

    # 4. Perform deterministic minimum-cost bipartite matching
    tol_samples = int(round((tolerance_ms / 1000.0) * fs))
    matched_pairs, fp_indices, fn_indices, latency_stats = match_detections_to_reference(
        ref_samples_eval, det_peaks_eval, tol_samples, fs=fs
    )

    # 5. Compute rigorous performance metrics
    tp = len(matched_pairs)
    fp = len(fp_indices)
    fn = len(fn_indices)
    total_ref = len(ref_samples_eval)
    total_det = len(det_peaks_eval)

    sensitivity = (tp / (tp + fn)) if (tp + fn) > 0 else (1.0 if total_ref == 0 else 0.0)
    ppv = (tp / (tp + fp)) if (tp + fp) > 0 else 0.0
    # Convention: DER = (FP + FN) / (TP + FN) = (FP + FN) / Total Ref
    der = ((fp + fn) / (tp + fn)) if (tp + fn) > 0 else 0.0
    # Event Accuracy: TP / (TP + FP + FN)
    event_accuracy = (tp / (tp + fp + fn)) if (tp + fp + fn) > 0 else 0.0

    # 6. Build event audit table for transparency and visualization
    # Each entry contains exact sample, timestamp, symbol, latency, and classification (TP, FP, FN)
    events_audit = []

    # Map matched
    matched_det_map = {d_idx: (r_idx, dist) for r_idx, d_idx, dist in matched_pairs}

    # Add all True Positives
    for r_idx, d_idx, _ in matched_pairs:
        r_samp = ref_samples_eval[r_idx]
        d_samp = det_peaks_eval[d_idx]
        delta_ms = ((d_samp - r_samp) / fs) * 1000.0
        events_audit.append({
            "event_id": f"TP-{r_idx}-{d_idx}",
            "classification": "TP",
            "reference_sample": r_samp,
            "reference_time_sec": round(r_samp / fs, 4),
            "symbol": ref_symbols_eval[r_idx],
            "detected_sample": d_samp,
            "detected_time_sec": round(d_samp / fs, 4),
            "delta_ms": round(delta_ms, 2),
            "abs_delta_ms": round(abs(delta_ms), 2),
            "time_sec": round(r_samp / fs, 4),
        })

    # Add False Negatives (unmatched reference beats)
    for fn_idx in fn_indices:
        r_samp = ref_samples_eval[fn_idx]
        events_audit.append({
            "event_id": f"FN-{fn_idx}",
            "classification": "FN",
            "reference_sample": r_samp,
            "reference_time_sec": round(r_samp / fs, 4),
            "symbol": ref_symbols_eval[fn_idx],
            "detected_sample": None,
            "detected_time_sec": None,
            "delta_ms": None,
            "abs_delta_ms": None,
            "time_sec": round(r_samp / fs, 4),
        })

    # Add False Positives (unmatched detections)
    for fp_idx in fp_indices:
        d_samp = det_peaks_eval[fp_idx]
        events_audit.append({
            "event_id": f"FP-{fp_idx}",
            "classification": "FP",
            "reference_sample": None,
            "reference_time_sec": None,
            "symbol": None,
            "detected_sample": d_samp,
            "detected_time_sec": round(d_samp / fs, 4),
            "delta_ms": None,
            "abs_delta_ms": None,
            "time_sec": round(d_samp / fs, 4),
        })

    # Sort events chronologically
    events_audit.sort(key=lambda x: x["time_sec"])

    # 7. Extract first 10 seconds signal snippet for high-performance waveform display
    display_snippet_sec = min(10.0, eval_duration_sec)
    display_snippet_samples = int(display_snippet_sec * fs)
    signal_snippet = [round(float(v), 4) for v in full_signal[:display_snippet_samples]]
    time_snippet = [round(float(t), 4) for t in np.arange(display_snippet_samples) / fs]

    snippet_events = [
        ev for ev in events_audit if ev["time_sec"] <= display_snippet_sec
    ]

    return {
        "record_id": record_id,
        "fs": fs,
        "duration_sec": round(eval_duration_sec, 2),
        "total_record_duration_sec": round(total_record_duration_sec, 2),
        "tolerance_ms": tolerance_ms,
        "tolerance_samples": tol_samples,
        "metrics": {
            "tp": tp,
            "fp": fp,
            "fn": fn,
            "total_reference_beats": total_ref,
            "total_detected_beats": total_det,
            "sensitivity": round(sensitivity, 5),
            "sensitivity_percent": round(sensitivity * 100.0, 2),
            "ppv": round(ppv, 5),
            "ppv_percent": round(ppv * 100.0, 2),
            "der": round(der, 5),
            "der_percent": round(der * 100.0, 2),
            "event_accuracy": round(event_accuracy, 5),
            "event_accuracy_percent": round(event_accuracy * 100.0, 2),
        },
        "latency": {
            "mean_ms": round(latency_stats["mean_ms"], 2),
            "median_ms": round(latency_stats["median_ms"], 2),
            "max_ms": round(latency_stats["max_ms"], 2),
            "std_ms": round(latency_stats["std_ms"], 2),
        },
        "events_audit": events_audit,
        "visualization": {
            "fs": fs,
            "snippet_duration_sec": round(display_snippet_sec, 2),
            "signal": signal_snippet,
            "time": time_snippet,
            "events": snippet_events,
        }
    }


def evaluate_records_batch(
    record_ids,
    data_loader,
    tolerance_ms=150.0,
    duration_sec=60.0,
    window_size_ms=150,
    lowcut=5.0,
    highcut=15.0,
):
    """
    Evaluates multiple records, producing both micro-aggregates (summed counts)
    and macro-aggregates (unweighted arithmetic mean of per-record metrics).
    """
    per_record_results = []
    all_abs_latencies = []

    sum_tp = 0
    sum_fp = 0
    sum_fn = 0
    sum_total_ref = 0
    sum_total_det = 0

    macro_sensitivities = []
    macro_ppvs = []
    macro_ders = []
    macro_accuracies = []

    for r_id in record_ids:
        res = evaluate_record(
            record_id=r_id,
            data_loader=data_loader,
            tolerance_ms=tolerance_ms,
            duration_sec=duration_sec,
            window_size_ms=window_size_ms,
            lowcut=lowcut,
            highcut=highcut,
        )
        per_record_results.append(res)

        m = res["metrics"]
        sum_tp += m["tp"]
        sum_fp += m["fp"]
        sum_fn += m["fn"]
        sum_total_ref += m["total_reference_beats"]
        sum_total_det += m["total_detected_beats"]

        macro_sensitivities.append(m["sensitivity"])
        macro_ppvs.append(m["ppv"])
        macro_ders.append(m["der"])
        macro_accuracies.append(m["event_accuracy"])

        # Collect event latencies for aggregate distribution
        for ev in res["events_audit"]:
            if ev["classification"] == "TP" and ev["abs_delta_ms"] is not None:
                all_abs_latencies.append(ev["abs_delta_ms"])

    k = max(1, len(per_record_results))

    # Micro Aggregates (derived strictly from summed events)
    micro_se = (sum_tp / (sum_tp + sum_fn)) if (sum_tp + sum_fn) > 0 else (1.0 if sum_total_ref == 0 else 0.0)
    micro_ppv = (sum_tp / (sum_tp + sum_fp)) if (sum_tp + sum_fp) > 0 else 0.0
    micro_der = ((sum_fp + sum_fn) / (sum_tp + sum_fn)) if (sum_tp + sum_fn) > 0 else 0.0
    micro_accuracy = (sum_tp / (sum_tp + sum_fp + sum_fn)) if (sum_tp + sum_fp + sum_fn) > 0 else 0.0

    # Macro Aggregates (arithmetic average of per-record scores)
    macro_se = float(np.mean(macro_sensitivities))
    macro_ppv = float(np.mean(macro_ppvs))
    macro_der = float(np.mean(macro_ders))
    macro_accuracy = float(np.mean(macro_accuracies))

    # Aggregate Latency Statistics
    if all_abs_latencies:
        agg_latency = {
            "mean_ms": round(float(np.mean(all_abs_latencies)), 2),
            "median_ms": round(float(np.median(all_abs_latencies)), 2),
            "max_ms": round(float(np.max(all_abs_latencies)), 2),
            "std_ms": round(float(np.std(all_abs_latencies)), 2),
        }
    else:
        agg_latency = {"mean_ms": 0.0, "median_ms": 0.0, "max_ms": 0.0, "std_ms": 0.0}

    reproducibility = {
        "tolerance_ms": tolerance_ms,
        "tolerance_samples": int(round((tolerance_ms / 1000.0) * 360)),  # nominal 360 Hz
        "duration_sec": duration_sec,
        "record_ids": record_ids,
        "evaluated_records_count": len(record_ids),
        "detector_parameters": {
            "window_size_ms": window_size_ms,
            "filter_lowcut": lowcut,
            "filter_highcut": highcut,
        },
        "evaluation_standard": "ANSI/AAMI EC57 (QRS detection fiducial matching)",
        "matching_algorithm": "Deterministic Minimum-Cost Bipartite Matching (scipy.optimize.linear_sum_assignment)"
    }

    return {
        "reproducibility": reproducibility,
        "paper_reference": PAPER_REFERENCE,
        "summary": {
            "micro": {
                "tp": sum_tp,
                "fp": sum_fp,
                "fn": sum_fn,
                "total_reference_beats": sum_total_ref,
                "total_detected_beats": sum_total_det,
                "sensitivity": round(micro_se, 5),
                "sensitivity_percent": round(micro_se * 100.0, 2),
                "ppv": round(micro_ppv, 5),
                "ppv_percent": round(micro_ppv * 100.0, 2),
                "der": round(micro_der, 5),
                "der_percent": round(micro_der * 100.0, 2),
                "event_accuracy": round(micro_accuracy, 5),
                "event_accuracy_percent": round(micro_accuracy * 100.0, 2),
            },
            "macro": {
                "sensitivity": round(macro_se, 5),
                "sensitivity_percent": round(macro_se * 100.0, 2),
                "ppv": round(macro_ppv, 5),
                "ppv_percent": round(macro_ppv * 100.0, 2),
                "der": round(macro_der, 5),
                "der_percent": round(macro_der * 100.0, 2),
                "event_accuracy": round(macro_accuracy, 5),
                "event_accuracy_percent": round(macro_accuracy * 100.0, 2),
            },
            "latency": agg_latency
        },
        "records": per_record_results
    }

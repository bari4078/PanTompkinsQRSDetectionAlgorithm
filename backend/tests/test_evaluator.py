import os
import sys
import unittest
import numpy as np

backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from data_loader import DataLoader
from evaluation.evaluator import (
    ANSI_AAMI_BEAT_SYMBOLS,
    PAPER_REFERENCE,
    match_detections_to_reference,
    evaluate_record,
    evaluate_records_batch,
)
from app import evaluate_records_endpoint, EvaluationRequest


class TestEvaluationModule(unittest.TestCase):

    # =========================================================================
    # 1. Deterministic Minimum-Cost Bipartite Matching Tests
    # =========================================================================
    def test_one_to_one_matching_minimizes_total_error(self):
        """
        Scenario:
          Reference beats at samples: 100, 150
          Detected beats at samples: 120, 140
          Tolerance = 40 samples

        Candidate edges:
          100 -> 120 (cost 20), 100 -> 140 (cost 40)
          150 -> 120 (cost 30), 150 -> 140 (cost 10)

        Option 1: (100 -> 120) + (150 -> 140) => total cost = 20 + 10 = 30
        Option 2: (100 -> 140) + (150 -> 120) => total cost = 40 + 30 = 70

        Minimum-cost bipartite matching MUST select Option 1.
        """
        ref_samples = [100, 150]
        det_samples = [120, 140]
        tol_samples = 40

        matched_pairs, fp_indices, fn_indices, latency_stats = match_detections_to_reference(
            ref_samples, det_samples, tol_samples, fs=360
        )

        self.assertEqual(len(matched_pairs), 2)
        self.assertEqual(len(fp_indices), 0)
        self.assertEqual(len(fn_indices), 0)

        # Matched pairs should be (0, 0) and (1, 1)
        self.assertEqual(matched_pairs[0][0], 0)
        self.assertEqual(matched_pairs[0][1], 0)
        self.assertEqual(matched_pairs[1][0], 1)
        self.assertEqual(matched_pairs[1][1], 1)

        # Check distances
        self.assertEqual(matched_pairs[0][2], 20)
        self.assertEqual(matched_pairs[1][2], 10)

    def test_outside_tolerance_unmatched(self):
        """
        Detections outside the tolerance window must remain unmatched (FP and FN).
        """
        ref_samples = [100]
        det_samples = [250]  # Distance = 150 > tol=50
        tol_samples = 50

        matched_pairs, fp_indices, fn_indices, latency_stats = match_detections_to_reference(
            ref_samples, det_samples, tol_samples, fs=360
        )

        self.assertEqual(len(matched_pairs), 0)
        self.assertEqual(fp_indices, [0])
        self.assertEqual(fn_indices, [0])

    def test_deterministic_tie_breaking(self):
        """
        When two detections have identical distance to a reference, the tie-breaker
        must be deterministic (earliest index prioritized).
        """
        ref_samples = [100]
        det_samples = [90, 110]  # Both distance = 10
        tol_samples = 20

        matched_pairs, fp_indices, fn_indices, _ = match_detections_to_reference(
            ref_samples, det_samples, tol_samples, fs=360
        )

        self.assertEqual(len(matched_pairs), 1)
        # Should deterministically pair with earliest detection index 0 (sample 90)
        self.assertEqual(matched_pairs[0][1], 0)
        self.assertEqual(fp_indices, [1])

    # =========================================================================
    # 2. Latency Distribution Metrics Tests
    # =========================================================================
    def test_latency_distribution_statistics(self):
        fs = 1000  # 1 sample = 1 ms for simplicity
        ref_samples = [100, 200, 300]
        det_samples = [105, 198, 310]  # deltas: +5, -2, +10 ms
        tol_samples = 50

        matched_pairs, fp, fn, latency = match_detections_to_reference(
            ref_samples, det_samples, tol_samples, fs=fs
        )

        abs_deltas = [5.0, 2.0, 10.0]
        self.assertAlmostEqual(latency["mean_ms"], np.mean(abs_deltas), places=2)
        self.assertAlmostEqual(latency["median_ms"], np.median(abs_deltas), places=2)
        self.assertAlmostEqual(latency["max_ms"], 10.0, places=2)
        self.assertAlmostEqual(latency["std_ms"], np.std(abs_deltas), places=2)

    # =========================================================================
    # 3. Provenance and Paper Reference Separation Tests
    # =========================================================================
    def test_paper_reference_integrity_and_derived_ppv(self):
        self.assertIn("citation", PAPER_REFERENCE)
        self.assertIn("dataset", PAPER_REFERENCE)
        self.assertEqual(PAPER_REFERENCE["sensitivity_percent"], 99.30)
        self.assertEqual(PAPER_REFERENCE["failure_rate_percent"], 0.675)
        self.assertEqual(PAPER_REFERENCE["total_beats"], 116137)
        self.assertEqual(PAPER_REFERENCE["false_positives"], 507)
        self.assertEqual(PAPER_REFERENCE["false_negatives"], 277)

        # Derived PPV check
        derived_tp = 116137 - 277
        derived_ppv = derived_tp / (derived_tp + 507)
        self.assertAlmostEqual(PAPER_REFERENCE["ppv_percent"], derived_ppv * 100.0, places=2)
        self.assertIn("derived", PAPER_REFERENCE["ppv_label"].lower())
        self.assertIn("disclaimer", PAPER_REFERENCE)

    # =========================================================================
    # 4. Single-Record Evaluation & Boundary Management
    # =========================================================================
    def test_evaluate_record_100(self):
        dl = DataLoader()
        res = evaluate_record(
            record_id="100",
            data_loader=dl,
            tolerance_ms=150.0,
            duration_sec=10.0,
        )

        self.assertEqual(res["record_id"], "100")
        self.assertEqual(res["duration_sec"], 10.0)
        self.assertEqual(res["tolerance_ms"], 150.0)

        metrics = res["metrics"]
        self.assertIn("tp", metrics)
        self.assertIn("fp", metrics)
        self.assertIn("fn", metrics)
        self.assertIn("sensitivity", metrics)
        self.assertIn("ppv", metrics)
        self.assertIn("der", metrics)
        self.assertIn("event_accuracy", metrics)

        # High accuracy on record 100
        self.assertGreaterEqual(metrics["sensitivity"], 0.90)
        self.assertGreaterEqual(metrics["ppv"], 0.90)

        # Events audit table exists and is populated
        self.assertGreater(len(res["events_audit"]), 0)
        first_event = res["events_audit"][0]
        self.assertIn("classification", first_event)
        self.assertIn(first_event["classification"], ["TP", "FP", "FN"])

        # Visualization snippet exists
        vis = res["visualization"]
        self.assertIn("signal", vis)
        self.assertIn("time", vis)
        self.assertIn("events", vis)
        self.assertLessEqual(vis["snippet_duration_sec"], 10.0)

    # =========================================================================
    # 5. Multi-Record Batch Evaluation (Micro vs Macro Aggregates)
    # =========================================================================
    def test_evaluate_records_batch_micro_macro(self):
        dl = DataLoader()
        batch_res = evaluate_records_batch(
            record_ids=["100", "101"],
            data_loader=dl,
            tolerance_ms=150.0,
            duration_sec=10.0,
        )

        self.assertIn("summary", batch_res)
        self.assertIn("micro", batch_res["summary"])
        self.assertIn("macro", batch_res["summary"])
        self.assertIn("reproducibility", batch_res)
        self.assertIn("paper_reference", batch_res)

        micro = batch_res["summary"]["micro"]
        macro = batch_res["summary"]["macro"]

        # Micro counts must equal sum of individual record counts
        r1_m = batch_res["records"][0]["metrics"]
        r2_m = batch_res["records"][1]["metrics"]
        self.assertEqual(micro["tp"], r1_m["tp"] + r2_m["tp"])
        self.assertEqual(micro["fp"], r1_m["fp"] + r2_m["fp"])
        self.assertEqual(micro["fn"], r1_m["fn"] + r2_m["fn"])

        # Macro must equal arithmetic mean of per-record metrics
        expected_macro_se = (r1_m["sensitivity"] + r2_m["sensitivity"]) / 2.0
        self.assertAlmostEqual(macro["sensitivity"], expected_macro_se, places=4)

    # =========================================================================
    # 6. API Endpoint Integration Test
    # =========================================================================
    def test_api_evaluate_endpoint(self):
        req = EvaluationRequest(
            record_ids=["100"],
            tolerance_ms=150.0,
            duration_sec=10.0,
        )
        data = evaluate_records_endpoint(req)

        self.assertIn("reproducibility", data)
        self.assertIn("paper_reference", data)
        self.assertIn("summary", data)
        self.assertIn("records", data)
        self.assertEqual(len(data["records"]), 1)


if __name__ == "__main__":
    unittest.main()

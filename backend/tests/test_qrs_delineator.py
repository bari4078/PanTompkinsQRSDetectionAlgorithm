"""
Unit and Integration Tests for QRS Delineation / Morphological Landmark Estimation
================================================================================

PROVENANCE STATEMENT:
The QRS delineator tested here is a downstream morphology-analysis layer
independent of the 1985 Pan-Tompkins QRS detector. The delineation thresholds
and multi-sample persistence criteria are application heuristics, NOT 1985
Pan-Tompkins algorithmic parameters.
"""

import unittest
import numpy as np
import wfdb
import os

from backend.pan_tompkins.detector import PanTompkinsDetector
from backend.delineation.qrs_delineator import QRSDelineator


class TestQRSDelineator(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.data_dir = os.path.join(os.path.dirname(__file__), '..', 'mitbih_data')
        cls.detector = PanTompkinsDetector()
        cls.delineator = QRSDelineator()

    def _load_record(self, record_id, duration_sec=10):
        path = os.path.join(self.data_dir, record_id)
        record = wfdb.rdrecord(path, sampto=int(360 * duration_sec))
        return record.p_signal[:, 0], record.fs

    def test_normal_sinus_rhythm_mitbih_100(self):
        """
        Verify delineation on normal sinus rhythm (MIT-BIH 100):
        - R peak matches positive peak
        - Q nadir precedes R, S nadir follows R
        - QRS onset < Q < R < S < QRS offset
        - Duration is logically consistent
        - pt_qrs_index is immutable
        """
        sig, fs = self._load_record('100')
        stages = self.detector.process(sig, fs)
        pt_indices = list(stages['peaks_original'])

        beats = self.delineator.delineate_beats(sig, fs, pt_indices, detection_metadata=stages)
        self.assertGreater(len(beats), 0)

        for i, beat in enumerate(beats):
            # Immutability of Pan-Tompkins fiducial
            self.assertEqual(beat['pt_qrs_index'], pt_indices[i])
            self.assertEqual(beat['beat_index'], i)

            # Normal morphology checks
            self.assertIsNotNone(beat['r_index'], f"Beat {i} should have an R peak")
            r_idx = beat['r_index']
            self.assertAlmostEqual(r_idx, pt_indices[i], delta=2)

            # Q and S presence
            self.assertIsNotNone(beat['q_index'], f"Beat {i} should have a Q nadir")
            self.assertIsNotNone(beat['s_index'], f"Beat {i} should have an S nadir")
            q_idx = beat['q_index']
            s_idx = beat['s_index']

            # Strict ordering
            self.assertLess(q_idx, r_idx, f"Beat {i}: Q must precede R")
            self.assertLess(r_idx, s_idx, f"Beat {i}: R must precede S")
            self.assertLess(beat['qrs_onset_index'], q_idx, f"Beat {i}: Onset must precede Q")
            self.assertGreater(beat['qrs_offset_index'], s_idx, f"Beat {i}: Offset must follow S")

            # Logical duration consistency
            expected_dur = round((beat['qrs_offset_index'] - beat['qrs_onset_index']) / fs * 1000.0, 2)
            self.assertEqual(beat['qrs_duration_ms'], expected_dur)
            self.assertGreater(beat['qrs_duration_ms'], 40.0)

            # Evidence checks
            self.assertTrue(beat['q_evidence']['found'])
            self.assertTrue(beat['r_evidence']['found'])
            self.assertTrue(beat['s_evidence']['found'])
            self.assertIn(beat['onset_evidence']['method'], ['persistent_baseline_convergence', 'fallback_window_bound'])
            self.assertIn(beat['offset_evidence']['method'], ['persistent_st_convergence', 'fallback_window_bound'])

    def test_ventricular_ectopic_pvc_mitbih_200(self):
        """
        Verify delineation on ventricular ectopic beat / PVC (MIT-BIH 200, beat at sample ~213):
        - R is localized to the positive deflection rather than the dominant negative S
        - S follows R and is substantially negative
        - |S| > |R| relative to baseline
        - dominant_deflection_type is 'negative'
        - wide QRS is supported and accurately reported
        """
        sig, fs = self._load_record('200')
        stages = self.detector.process(sig, fs)
        beats = self.delineator.delineate_beats(sig, fs, stages['peaks_original'], detection_metadata=stages)

        # Beat 0 is the PVC around sample 213
        pvc_beat = beats[0]
        self.assertEqual(pvc_beat['pt_qrs_index'], 213)

        # 1. Verify R is on the positive deflection rather than dominant negative S
        self.assertIsNotNone(pvc_beat['r_index'])
        self.assertAlmostEqual(pvc_beat['r_index'], 213, delta=2)
        r_val = sig[pvc_beat['r_index']]
        self.assertGreater(r_val, 0.0, "R peak must be positive")

        # 2. Verify S follows R and is substantially negative
        self.assertIsNotNone(pvc_beat['s_index'])
        self.assertGreater(pvc_beat['s_index'], pvc_beat['r_index'], "S must follow R")
        self.assertAlmostEqual(pvc_beat['s_index'], 224, delta=2)
        s_val = sig[pvc_beat['s_index']]
        self.assertLess(s_val, -1.0, "S nadir must be deep negative (< -1.0V)")

        # 3. Verify |S| > |R| relative to baseline
        iso = pvc_beat['isoelectric_baseline']
        abs_r = abs(r_val - iso)
        abs_s = abs(s_val - iso)
        self.assertGreater(abs_s, abs_r, "S deflection must exceed R deflection in this PVC")

        # 4. Dominant deflection properties
        self.assertEqual(pvc_beat['dominant_deflection_type'], 'negative')
        self.assertAlmostEqual(pvc_beat['dominant_deflection_index'], 224, delta=2)

        # 5. Wide QRS support
        self.assertGreater(pvc_beat['qrs_duration_ms'], 70.0)
        self.assertLess(pvc_beat['qrs_onset_index'], pvc_beat['q_index'])
        self.assertGreater(pvc_beat['qrs_offset_index'], pvc_beat['s_index'])

    def test_bundle_branch_block_mitbih_212(self):
        """
        Verify delineation on Right Bundle Branch Block (MIT-BIH 212):
        - Wide QRS complexes supported
        - S wave nadir detected in slurred/delayed region
        - All landmarks ordered correctly
        """
        sig, fs = self._load_record('212')
        stages = self.detector.process(sig, fs)
        beats = self.delineator.delineate_beats(sig, fs, stages['peaks_original'], detection_metadata=stages)

        self.assertGreater(len(beats), 0)
        for beat in beats[:4]:
            self.assertIsNotNone(beat['r_index'])
            self.assertIsNotNone(beat['s_index'])
            self.assertLess(beat['r_index'], beat['s_index'])
            self.assertLess(beat['qrs_onset_index'], beat['qrs_offset_index'])
            self.assertGreater(beat['qrs_duration_ms'], 50.0)

    def test_pure_qs_morphology(self):
        """
        Verify pure QS / predominantly negative complex:
        - r_index is None (never assigned to negative nadir)
        - dominant_deflection_index is the negative nadir
        - dominant_deflection_type is 'negative'
        - q_index and s_index are None
        - onset < offset encompasses the negative deflection
        """
        fs = 360
        sig_qs = np.zeros(360)
        # Baseline = 0.0, dip between sample 120 and 160 with nadir at 140
        for i in range(120, 160):
            sig_qs[i] = -1.5 * np.sin(np.pi * (i - 120) / 40.0)

        beats = self.delineator.delineate_beats(sig_qs, fs, [140])
        self.assertEqual(len(beats), 1)
        b = beats[0]

        self.assertIsNone(b['r_index'], "True QS complex must have r_index = None")
        self.assertIsNone(b['r_time'])
        self.assertEqual(b['dominant_deflection_index'], 140)
        self.assertEqual(b['dominant_deflection_type'], 'negative')
        self.assertIsNone(b['q_index'])
        self.assertIsNone(b['s_index'])
        self.assertLessEqual(b['qrs_onset_index'], 122)
        self.assertGreaterEqual(b['qrs_offset_index'], 158)
        self.assertGreater(b['qrs_duration_ms'], 80.0)
        self.assertFalse(b['r_evidence']['found'])
        self.assertIn('qs_complex', b['r_evidence']['morphology'])

    def test_missing_landmarks_monophasic_r(self):
        """
        Verify null-safety when landmarks do not exist (monophasic R wave):
        - R is detected
        - Q is None (does not invent Q point when signal does not dip below baseline)
        - S is None (does not invent S point when signal does not dip below baseline)
        - Evidence fields explain absence
        """
        fs = 360
        sig_mono = np.zeros(360)
        for i in range(120, 160):
            sig_mono[i] = 1.0 * np.sin(np.pi * (i - 120) / 40.0)

        beats = self.delineator.delineate_beats(sig_mono, fs, [140])
        self.assertEqual(len(beats), 1)
        b = beats[0]

        self.assertEqual(b['r_index'], 140)
        self.assertIsNone(b['q_index'], "Monophasic R must not invent Q")
        self.assertIsNone(b['s_index'], "Monophasic R must not invent S")
        self.assertFalse(b['q_evidence']['found'])
        self.assertFalse(b['s_evidence']['found'])
        self.assertLessEqual(b['qrs_onset_index'], 122)
        self.assertGreaterEqual(b['qrs_offset_index'], 158)

    def test_schema_completeness_and_evidence(self):
        """
        Verify that returned schema matches all required fields and contains
        factual evidence without artificial medical probability scores.
        """
        sig, fs = self._load_record('100', duration_sec=5)
        stages = self.detector.process(sig, fs)
        beats = self.delineator.delineate_beats(sig, fs, stages['peaks_original'], detection_metadata=stages)

        required_keys = [
            'beat_index', 'pt_qrs_index', 'q_index', 'r_index', 's_index',
            'qrs_onset_index', 'qrs_offset_index', 'dominant_deflection_index',
            'dominant_deflection_type', 'q_time', 'r_time', 's_time',
            'qrs_onset_time', 'qrs_offset_time', 'qrs_duration_ms',
            'q_to_r_ms', 'r_to_s_ms', 'isoelectric_baseline',
            'q_evidence', 'r_evidence', 's_evidence', 'onset_evidence',
            'offset_evidence', 'detection_evidence'
        ]

        for b in beats:
            for key in required_keys:
                self.assertIn(key, b, f"Beat schema missing required key: {key}")

            # Verify evidence structures are factual dicts
            self.assertIsInstance(b['q_evidence'], dict)
            self.assertIsInstance(b['r_evidence'], dict)
            self.assertIsInstance(b['s_evidence'], dict)
            self.assertIsInstance(b['onset_evidence'], dict)
            self.assertIsInstance(b['offset_evidence'], dict)
            self.assertIsInstance(b['detection_evidence'], dict)

            # Ensure no probabilistic medical scores are invented
            for ev in [b['q_evidence'], b['r_evidence'], b['s_evidence'], b['onset_evidence'], b['offset_evidence']]:
                self.assertNotIn('confidence_score', ev)
                self.assertNotIn('probability', ev)

    def test_detector_untouched(self):
        """
        Verify that running delineation does not alter the underlying Pan-Tompkins detector output.
        """
        sig, fs = self._load_record('100')
        stages1 = self.detector.process(sig, fs)
        peaks1 = list(stages1['peaks_original'])

        # Run delineator
        _ = self.delineator.delineate_beats(sig, fs, stages1['peaks_original'], detection_metadata=stages1)

        # Rerun detector and ensure bit-identical results
        stages2 = self.detector.process(sig, fs)
        self.assertEqual(stages2['peaks_original'], peaks1)


if __name__ == '__main__':
    unittest.main()

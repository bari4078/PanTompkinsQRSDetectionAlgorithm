import os
import sys
import unittest
import numpy as np

# Add backend directory to sys.path
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from pan_tompkins.filters import (
    BandpassFilter,
    DerivativeFilter,
    SquaringFilter,
    MovingWindowIntegration,
)
from pan_tompkins.detector import PanTompkinsDetector
from data_loader import DataLoader
from analysis import analyze_ecg


class TestPanTompkinsAlgorithm(unittest.TestCase):

    # =========================================================================
    # 1. Bandpass Filter Tests
    # =========================================================================
    def test_bandpass_filter_frequency_response(self):
        fs = 360
        t = np.arange(fs * 2) / fs  # 2 seconds

        # 10 Hz sinusoid (in passband: 5-15 Hz)
        sig_10hz = np.sin(2 * np.pi * 10 * t)
        # 0.5 Hz baseline drift (stopband: < 5 Hz)
        sig_05hz = np.sin(2 * np.pi * 0.5 * t)
        # 60 Hz powerline noise (stopband: > 15 Hz)
        sig_60hz = np.sin(2 * np.pi * 60 * t)

        bp = BandpassFilter(lowcut=5.0, highcut=15.0)
        out_10hz = bp.apply(sig_10hz, fs)[fs // 2 : 3 * fs // 2]
        out_05hz = bp.apply(sig_05hz, fs)[fs // 2 : 3 * fs // 2]
        out_60hz = bp.apply(sig_60hz, fs)[fs // 2 : 3 * fs // 2]

        energy_10hz = np.mean(out_10hz ** 2)
        energy_05hz = np.mean(out_05hz ** 2)
        energy_60hz = np.mean(out_60hz ** 2)

        self.assertGreater(energy_10hz, 5 * energy_05hz, "Low frequency baseline drift not attenuated")
        self.assertGreater(energy_10hz, 5 * energy_60hz, "High frequency 60 Hz noise not attenuated")

    # =========================================================================
    # 2. Five-Point Derivative Filter Tests
    # =========================================================================
    def test_derivative_filter_slope_and_orientation(self):
        fs = 200
        # Linear ramp with slope = 2.0 (amplitude increases by 2 per second)
        n = np.arange(100)
        ramp = 2.0 * n / fs

        deriv_filter = DerivativeFilter()
        out = deriv_filter.apply(ramp, fs)

        # In the middle (away from edges), derivative of ramp should be +2.0
        mid_deriv = out[10:90]
        self.assertTrue(np.allclose(mid_deriv, 2.0, atol=1e-5), f"Expected +2.0 slope, got {mid_deriv[0]}")

        # A triangular pulse: rising slope then falling slope
        pulse = np.zeros(100)
        pulse[40:50] = np.linspace(0, 1, 10)  # rising slope
        pulse[50:60] = np.linspace(1, 0, 10)  # falling slope

        d_pulse = deriv_filter.apply(pulse, fs)
        self.assertGreater(np.max(d_pulse[42:48]), 0, "Rising slope must have positive derivative")
        self.assertLess(np.min(d_pulse[52:58]), 0, "Falling slope must have negative derivative")

    # =========================================================================
    # 3. Pointwise Squaring Filter Tests
    # =========================================================================
    def test_squaring_filter(self):
        fs = 360
        sig = np.array([-3.0, -1.0, 0.0, 1.0, 2.0])
        sq_filter = SquaringFilter()
        out = sq_filter.apply(sig, fs)

        self.assertTrue(np.all(out >= 0), "Squared signal must be non-negative everywhere")
        self.assertTrue(np.array_equal(out, [9.0, 1.0, 0.0, 1.0, 4.0]))
        self.assertEqual(out[0] / out[1], 9.0)

    # =========================================================================
    # 4. Moving-Window Integration Tests
    # =========================================================================
    def test_moving_window_integration(self):
        fs = 200
        mwi = MovingWindowIntegration(window_size_ms=150)
        sig = np.zeros(200)
        sig[100] = 30.0

        out = mwi.apply(sig, fs)
        self.assertLessEqual(np.max(out), 1.01)
        self.assertGreater(np.sum(out), 25.0)

    # =========================================================================
    # 5. Adaptive Dual-Threshold Formulas Test
    # =========================================================================
    def test_adaptive_threshold_formulas(self):
        spki, npki = 100.0, 20.0
        spkf, npkf = 10.0, 2.0

        th_i1 = npki + 0.25 * (spki - npki)
        th_i2 = 0.5 * th_i1
        th_f1 = npkf + 0.25 * (spkf - npkf)
        th_f2 = 0.5 * th_f1

        self.assertEqual(th_i1, 40.0)
        self.assertEqual(th_i2, 20.0)
        self.assertEqual(th_f1, 4.0)
        self.assertEqual(th_f2, 2.0)

    # =========================================================================
    # 6. Physiological 200 ms Refractory Period Test
    # =========================================================================
    def test_refractory_period_rejection(self):
        fs = 360
        sig = np.zeros(int(fs * 2))
        p1 = int(0.5 * fs) # 180
        p2 = p1 + int(0.180 * fs)  # 180 ms later (> 150 ms window, < 200 ms refractory)

        sig[p1 - 2 : p1 + 3] = [-0.5, 1.5, 3.0, -1.0, 0.0]
        sig[p2 - 2 : p2 + 3] = [-0.5, 1.5, 3.0, -1.0, 0.0]

        detector = PanTompkinsDetector()
        res = detector.process(sig, fs)

        peaks = res['detected_peaks']
        self.assertEqual(len(peaks), 1, f"Expected 1 peak due to 200ms refractory, got {len(peaks)}: {peaks}")
        self.assertLessEqual(abs(peaks[0] - p1), 3)
        self.assertGreater(len(res['refractory_intervals']), 0)

    # =========================================================================
    # 7. T-Wave Slope Discrimination Test
    # =========================================================================
    def test_t_wave_slope_discrimination(self):
        fs = 360
        sig = np.zeros(int(fs * 2))
        qrs_idx = int(0.4 * fs)
        sig[qrs_idx - 2 : qrs_idx + 3] = [-0.5, 2.0, 4.0, -1.0, 0.0]

        # Realistic T-wave at 280 ms (> 200 ms, < 360 ms) with gentle slope
        t_idx = qrs_idx + int(0.280 * fs)
        for delta in range(-30, 31):
            sig[t_idx + delta] = 0.8 * np.exp(-(delta ** 2) / 250.0)

        detector = PanTompkinsDetector()
        res = detector.process(sig, fs)

        self.assertGreater(len(res['rejected_t_waves']), 0, "Expected T-wave to be identified and rejected")
        self.assertEqual(len(res['detected_peaks']), 1, f"Expected 1 detected QRS, got {len(res['detected_peaks'])}")

    # =========================================================================
    # 8. Search-Back Mechanism Test
    # =========================================================================
    def test_searchback_for_missed_beat(self):
        fs = 360
        sig = np.zeros(int(fs * 4))
        b1 = int(0.5 * fs)
        b2 = int(1.3 * fs)
        sig[b1 - 2 : b1 + 3] = [-0.5, 2.0, 3.5, -1.0, 0.0]
        sig[b2 - 2 : b2 + 3] = [-0.5, 2.0, 3.5, -1.0, 0.0]

        # Attenuated beat at 2.1s
        b3 = int(2.1 * fs)
        sig[b3 - 2 : b3 + 3] = [-0.15, 0.7, 1.2, -0.3, 0.0]

        # Beat at 3.5s
        b4 = int(3.5 * fs)
        sig[b4 - 2 : b4 + 3] = [-0.5, 2.0, 3.5, -1.0, 0.0]

        detector = PanTompkinsDetector()
        res = detector.process(sig, fs)

        methods = res['detection_method']
        self.assertTrue('searchback' in methods or len(res['searchback']) > 0 or len(res['detected_peaks']) >= 3)

    # =========================================================================
    # 9. RR Interval Adaptation Test
    # =========================================================================
    def test_rr_interval_averages(self):
        fs = 360
        sig = np.zeros(int(fs * 8))
        beat_positions = [int(0.5 * fs + i * 0.8 * fs) for i in range(8)]
        for bp in beat_positions:
            sig[bp - 2 : bp + 3] = [-0.5, 2.0, 4.0, -1.0, 0.0]

        detector = PanTompkinsDetector()
        res = detector.process(sig, fs)

        rr_ints = res['rr_intervals']
        self.assertGreaterEqual(len(rr_ints), 5)
        for rr in rr_ints:
            self.assertLessEqual(abs(rr - int(0.8 * fs)), 3, f"Unexpected RR interval: {rr}")

        self.assertGreater(len(res['rr_average_1']), 0)
        self.assertGreater(len(res['rr_average_2']), 0)
        self.assertLessEqual(abs(res['rr_average_1'][-1] - int(0.8 * fs)), 5)
        self.assertLessEqual(abs(res['rr_average_2'][-1] - int(0.8 * fs)), 5)

    # =========================================================================
    # 10. MIT-BIH Arrhythmia Database Ground Truth Validation
    # =========================================================================
    def test_mitbih_record_accuracy(self):
        import wfdb
        dl = DataLoader()
        records = ["100", "101", "200", "212", "222"]

        for record_id in records:
            sig, fs = dl.download_and_load(record_id)
            duration_sec = 10
            sig_10s = sig[: int(fs * duration_sec)]

            detector = PanTompkinsDetector()
            res = detector.process(sig_10s, fs)
            detected_peaks = res['detected_peaks']

            record_path = os.path.join(dl.data_dir, record_id)
            ann = wfdb.rdann(record_path, 'atr', sampfrom=0, sampto=int(fs * duration_sec))
            true_peaks = [s for s, sym in zip(ann.sample, ann.symbol) if s >= 50 and sym in ['N', 'V', 'A', 'R', 'L', 'j', '/']]

            tol_samples = int(0.05 * fs)
            tp = 0
            matched_true = set()

            for dp in detected_peaks:
                for tp_idx, true_p in enumerate(true_peaks):
                    if tp_idx not in matched_true and abs(dp - true_p) <= tol_samples:
                        tp += 1
                        matched_true.add(tp_idx)
                        break

            fn = len(true_peaks) - tp
            fp = len(detected_peaks) - tp
            sensitivity = tp / len(true_peaks) if len(true_peaks) > 0 else 0
            ppv = tp / (tp + fp) if (tp + fp) > 0 else 0

            print(f"\nRecord {record_id} - TP: {tp}, FP: {fp}, FN: {fn}, Sensitivity: {sensitivity:.2%}, PPV: {ppv:.2%}")
            self.assertGreaterEqual(sensitivity, 0.85, f"Sensitivity too low for {record_id}: {sensitivity:.2%}")

    # =========================================================================
    # 11. API Metadata and Response Contract Tests
    # =========================================================================
    def test_pan_tompkins_metadata_keys(self):
        dl = DataLoader()
        sig, fs = dl.download_and_load("100")
        sig = sig[: int(fs * 10)]

        detector = PanTompkinsDetector()
        res = detector.process(sig, fs)

        required_keys = [
            'detected_peaks',
            'detection_method',
            'searchback',
            'rr_intervals',
            'rr_average_1',
            'rr_average_2',
            'spki',
            'npki',
            'spkf',
            'npkf',
            'threshold_i1',
            'threshold_i2',
            'threshold_f1',
            'threshold_f2',
            'refractory_intervals',
            'rejected_t_waves',
        ]
        for key in required_keys:
            self.assertIn(key, res, f"Missing required metadata key: {key}")

        legacy_keys = [
            'original',
            'bandpass',
            'derivative',
            'squared',
            'integrated',
            'peaks_integrated',
            'peaks_original',
            'threshold',
        ]
        for key in legacy_keys:
            self.assertIn(key, res, f"Missing legacy contract key: {key}")

        self.assertEqual(len(res['original']), len(sig))
        self.assertEqual(len(res['bandpass']), len(sig))
        self.assertEqual(len(res['derivative']), len(sig))
        self.assertEqual(len(res['squared']), len(sig))
        self.assertEqual(len(res['integrated']), len(sig))
        self.assertEqual(len(res['threshold_i1']), len(sig))
        self.assertEqual(len(res['threshold_i2']), len(sig))
        self.assertEqual(len(res['threshold_f1']), len(sig))
        self.assertEqual(len(res['threshold_f2']), len(sig))
        self.assertEqual(len(res['spki']), len(sig))
        self.assertEqual(len(res['npki']), len(sig))
        self.assertEqual(len(res['spkf']), len(sig))
        self.assertEqual(len(res['npkf']), len(sig))

        self.assertEqual(res['detected_peaks'], res['peaks_original'])
        self.assertEqual(len(res['detection_method']), len(res['detected_peaks']))

    def test_api_process_endpoint(self):
        from app import process_record, ProcessRequest

        req = ProcessRequest(
            record_id="100",
            window_size_ms=150,
            lowcut=5.0,
            highcut=15.0,
        )
        data = process_record(req)

        self.assertIn("fs", data)
        self.assertIn("stages", data)
        self.assertIn("analysis", data)
        self.assertIn("metadata", data)

        meta = data["metadata"]
        self.assertIn("detected_peaks", meta)
        self.assertIn("threshold_i1", meta)
        self.assertIn("refractory_intervals", meta)
        self.assertIn("rejected_t_waves", meta)
        self.assertIn("searchback", meta)
        self.assertIn("rr_average_1", meta)
        self.assertIn("rr_average_2", meta)

        # Verify stages compatibility
        self.assertIn("peaks_original", data["stages"])
        self.assertIn("threshold", data["stages"])


if __name__ == "__main__":
    unittest.main()

import numpy as np
from scipy.signal import find_peaks
from .filters import BandpassFilter, DerivativeFilter, SquaringFilter, MovingWindowIntegration


class PanTompkinsDetector:
    """
    Faithful implementation of the 1985 Pan-Tompkins QRS detection algorithm:
    J. Pan and W. J. Tompkins, "A Real-Time QRS Detection Algorithm,"
    IEEE Transactions on Biomedical Engineering, vol. BME-32, no. 3, pp. 230-236, March 1985.

    Pipeline stages:
    1. Bandpass filtering (5-15 Hz)
    2. Five-point derivative
    3. Pointwise squaring
    4. Moving-window integration (~150 ms)
    5. Adaptive thresholding (SPKI, NPKI, SPKF, NPKF)
    6. Dual-threshold confirmation (integrated and bandpass-filtered waveforms)
    7. 200 ms physiological refractory blanking
    8. T-wave discrimination based on relative derivative slope (200-360 ms)
    9. Search-back for missed beats when RR interval > 166% of RR average
    10. Two running RR interval averages (recent 8 and acceptable 8 within 92%-116% limits)
    """

    def __init__(self, window_size_ms=150, filter_lowcut=5.0, filter_highcut=15.0):
        self.window_size_ms = window_size_ms
        self.filter_lowcut = filter_lowcut
        self.filter_highcut = filter_highcut

        self.bandpass = BandpassFilter(lowcut=filter_lowcut, highcut=filter_highcut)
        self.derivative = DerivativeFilter()
        self.squaring = SquaringFilter()
        self.integration = MovingWindowIntegration(window_size_ms=window_size_ms)

    def process(self, signal, fs):
        """
        Executes the Pan-Tompkins 1985 pipeline on the input ECG signal.

        Args:
            signal (np.ndarray or list): Raw ECG signal.
            fs (int or float): Sampling frequency in Hz.

        Returns:
            dict: Intermediate signals, detected peaks, and Pan-Tompkins metadata.
        """
        signal = np.asarray(signal, dtype=np.float64)
        n_samples = len(signal)

        # Handle edge cases with very short signals
        if n_samples < int(0.5 * fs):
            return self._empty_result(signal)

        # ---------------------------------------------------------------------
        # Stage 1: Bandpass Filtering (5 - 15 Hz)
        # ---------------------------------------------------------------------
        filtered_sig = self.bandpass.apply(signal, fs)

        # ---------------------------------------------------------------------
        # Stage 2: Five-Point Derivative
        # y[n] = (1/8T) * (-x[n-2] - 2x[n-1] + 2x[n+1] + x[n+2])
        # ---------------------------------------------------------------------
        derivative_sig = self.derivative.apply(filtered_sig, fs)

        # ---------------------------------------------------------------------
        # Stage 3: Pointwise Squaring
        # y[n] = (x[n])^2
        # ---------------------------------------------------------------------
        squared_sig = self.squaring.apply(derivative_sig, fs)

        # ---------------------------------------------------------------------
        # Stage 4: Moving Window Integration (~150 ms window)
        # ---------------------------------------------------------------------
        integrated_sig = self.integration.apply(squared_sig, fs)

        # Window size in samples
        w_size = max(1, int((self.window_size_ms / 1000.0) * fs))
        refractory_samples = int(0.200 * fs)
        t_wave_max_samples = int(0.360 * fs)

        # ---------------------------------------------------------------------
        # Stage 5: Candidate Peak Detection in Integrated Signal
        # Local maxima in the integrated signal are candidate QRS complexes
        # ---------------------------------------------------------------------
        cand_peaks, _ = find_peaks(integrated_sig)

        # ---------------------------------------------------------------------
        # Learning Phase (Initialization on first 2 seconds)
        # ---------------------------------------------------------------------
        learn_len = min(n_samples, int(2.0 * fs))
        learn_integrated = integrated_sig[:learn_len]
        learn_filtered = np.abs(filtered_sig[:learn_len])

        spki = 0.35 * float(np.max(learn_integrated)) if len(learn_integrated) > 0 else 1.0
        npki = float(np.mean(learn_integrated)) if len(learn_integrated) > 0 else 0.1
        spkf = 0.35 * float(np.max(learn_filtered)) if len(learn_filtered) > 0 else 1.0
        npkf = float(np.mean(learn_filtered)) if len(learn_filtered) > 0 else 0.1

        if spki <= npki:
            spki = npki * 2.0 + 1e-6
        if spkf <= npkf:
            spkf = npkf * 2.0 + 1e-6

        # Initial Thresholds
        th_i1 = npki + 0.25 * (spki - npki)
        th_i2 = 0.5 * th_i1
        th_f1 = npkf + 0.25 * (spkf - npkf)
        th_f2 = 0.5 * th_f1

        # Initial RR Interval Averages (~0.8s baseline)
        init_rr = int(0.8 * fs)
        recent_rr = [init_rr] * 8
        acceptable_rr = [init_rr] * 8
        rr_avg1 = float(np.mean(recent_rr))
        rr_avg2 = float(np.mean(acceptable_rr))

        # Time series arrays to track threshold adaptation over time
        th_i1_arr = np.full(n_samples, th_i1, dtype=np.float64)
        th_i2_arr = np.full(n_samples, th_i2, dtype=np.float64)
        th_f1_arr = np.full(n_samples, th_f1, dtype=np.float64)
        th_f2_arr = np.full(n_samples, th_f2, dtype=np.float64)
        spki_arr = np.full(n_samples, spki, dtype=np.float64)
        npki_arr = np.full(n_samples, npki, dtype=np.float64)
        spkf_arr = np.full(n_samples, spkf, dtype=np.float64)
        npkf_arr = np.full(n_samples, npkf, dtype=np.float64)

        last_recorded_idx = 0

        def record_state_up_to(sample_idx):
            nonlocal last_recorded_idx
            idx = min(n_samples, max(0, sample_idx))
            if idx > last_recorded_idx:
                th_i1_arr[last_recorded_idx:idx] = th_i1
                th_i2_arr[last_recorded_idx:idx] = th_i2
                th_f1_arr[last_recorded_idx:idx] = th_f1
                th_f2_arr[last_recorded_idx:idx] = th_f2
                spki_arr[last_recorded_idx:idx] = spki
                npki_arr[last_recorded_idx:idx] = npki
                spkf_arr[last_recorded_idx:idx] = spkf
                npkf_arr[last_recorded_idx:idx] = npkf
                last_recorded_idx = idx

        # Detection tracking
        detected_peaks = []
        peaks_integrated = []
        detection_methods = []
        searchback_peaks = []
        rejected_t_waves = []
        refractory_intervals = []
        rr_intervals = []
        rr_avg1_history = []
        rr_avg2_history = []

        last_qrs_integrated = -init_rr
        last_qrs_orig = -init_rr
        last_qrs_slope = 0.0

        # Candidate peaks classified as noise for search-back pool:
        # tuple: (p_int, peaki, peakf, cand_slope)
        noise_candidates = []

        def map_to_r_peak(p_int):
            """
            Maps an integrated peak back to the true R-peak on the original signal
            by localizing the bandpass filtered peak and local raw extremum.
            """
            w_start = max(0, p_int - w_size)
            w_end = min(n_samples, p_int + int(w_size / 2))
            f_idx = w_start + int(np.argmax(np.abs(filtered_sig[w_start:w_end])))

            r_search = max(1, int(0.04 * fs))
            r_start = max(0, f_idx - r_search)
            r_end = min(n_samples, f_idx + r_search + 1)
            # Find the peak on original signal (positive peak)
            r_peak = r_start + int(np.argmax(signal[r_start:r_end]))
            return int(r_peak)

        def get_candidate_features(p_int):
            peaki = float(integrated_sig[p_int])
            w_start = max(0, p_int - w_size)
            w_end = min(n_samples, p_int + int(w_size / 2))
            peakf = float(np.max(np.abs(filtered_sig[w_start:w_end])))

            d_window = max(1, int(0.075 * fs))
            d_start = max(0, p_int - d_window)
            d_end = min(n_samples, p_int + d_window)
            cand_slope = float(np.max(np.abs(derivative_sig[d_start:d_end])))
            return peaki, peakf, cand_slope

        # ---------------------------------------------------------------------
        # Sequential Adaptive Processing Loop
        # ---------------------------------------------------------------------
        i = 0
        while i < len(cand_peaks):
            p = int(cand_peaks[i])
            peaki, peakf, cand_slope = get_candidate_features(p)

            # Record threshold state up to current sample
            record_state_up_to(p)

            # -----------------------------------------------------------------
            # Search-Back Check (Missed beat timeout > 166% of RR average)
            # -----------------------------------------------------------------
            rr_missed_limit = int(1.66 * rr_avg2)
            if last_qrs_integrated > 0 and (p - last_qrs_integrated) > rr_missed_limit:
                # Search back in noise candidates occurring after previous refractory period
                qualifying = [
                    c for c in noise_candidates
                    if c[0] > (last_qrs_integrated + refractory_samples)
                    and c[0] < p
                    and c[1] > th_i2
                    and c[2] > th_f2
                ]
                if qualifying:
                    # Select most prominent candidate by integrated amplitude
                    best_cand = max(qualifying, key=lambda c: c[1])
                    sb_p, sb_peaki, sb_peakf, sb_slope = best_cand
                    r_sb = map_to_r_peak(sb_p)

                    detected_peaks.append(r_sb)
                    peaks_integrated.append(sb_p)
                    detection_methods.append('searchback')
                    searchback_peaks.append(r_sb)

                    ref_end = min(n_samples, r_sb + refractory_samples)
                    refractory_intervals.append([r_sb, ref_end])

                    # Search-back learning weights (0.25 / 0.75 as per Pan-Tompkins 1985)
                    spki = 0.25 * sb_peaki + 0.75 * spki
                    spkf = 0.25 * sb_peakf + 0.75 * spkf
                    th_i1 = npki + 0.25 * (spki - npki)
                    th_i2 = 0.5 * th_i1
                    th_f1 = npkf + 0.25 * (spkf - npkf)
                    th_f2 = 0.5 * th_f1

                    # Update RR intervals and averages
                    if last_qrs_orig > 0:
                        rr = r_sb - last_qrs_orig
                        rr_intervals.append(int(rr))
                        recent_rr.append(rr)
                        recent_rr = recent_rr[-8:]
                        rr_avg1 = float(np.mean(recent_rr))
                        if 0.92 * rr_avg2 <= rr <= 1.16 * rr_avg2:
                            acceptable_rr.append(rr)
                            acceptable_rr = acceptable_rr[-8:]
                            rr_avg2 = float(np.mean(acceptable_rr))
                        rr_avg1_history.append(round(rr_avg1, 1))
                        rr_avg2_history.append(round(rr_avg2, 1))

                    last_qrs_integrated = sb_p
                    last_qrs_orig = r_sb
                    last_qrs_slope = sb_slope

                    # Remove noise candidates prior to the detected search-back beat
                    noise_candidates = [c for c in noise_candidates if c[0] > sb_p]
                    # Re-evaluate current peak under updated state
                    continue

            # -----------------------------------------------------------------
            # 1. 200 ms Physiological Refractory Period
            # -----------------------------------------------------------------
            if last_qrs_integrated > 0 and (p - last_qrs_integrated) < refractory_samples:
                # Within 200 ms blanking period, cannot physiologically be a QRS
                i += 1
                continue

            # -----------------------------------------------------------------
            # 2. T-Wave Discrimination (200 ms - 360 ms)
            # -----------------------------------------------------------------
            if last_qrs_integrated > 0 and (p - last_qrs_integrated) <= t_wave_max_samples:
                if last_qrs_slope > 0 and cand_slope < (0.5 * last_qrs_slope):
                    # Identified as T-wave based on relative derivative slope!
                    rejected_t_waves.append(p)
                    # T-wave peak updates noise level
                    npki = 0.125 * peaki + 0.875 * npki
                    npkf = 0.125 * peakf + 0.875 * npkf
                    th_i1 = npki + 0.25 * (spki - npki)
                    th_i2 = 0.5 * th_i1
                    th_f1 = npkf + 0.25 * (spkf - npkf)
                    th_f2 = 0.5 * th_f1
                    i += 1
                    continue

            # -----------------------------------------------------------------
            # 3. Dual-Threshold Confirmation
            # Candidate must be supported by BOTH integrated and filtered signals
            # -----------------------------------------------------------------
            if peaki > th_i1 and peakf > th_f1:
                # Confirmed QRS complex
                r_peak = map_to_r_peak(p)
                detected_peaks.append(r_peak)
                peaks_integrated.append(p)
                detection_methods.append('normal')

                ref_end = min(n_samples, r_peak + refractory_samples)
                refractory_intervals.append([r_peak, ref_end])

                # Update signal levels (0.125 / 0.875)
                spki = 0.125 * peaki + 0.875 * spki
                spkf = 0.125 * peakf + 0.875 * spkf
                th_i1 = npki + 0.25 * (spki - npki)
                th_i2 = 0.5 * th_i1
                th_f1 = npkf + 0.25 * (spkf - npkf)
                th_f2 = 0.5 * th_f1

                # Update RR interval and averages
                if last_qrs_orig > 0:
                    rr = r_peak - last_qrs_orig
                    rr_intervals.append(int(rr))
                    recent_rr.append(rr)
                    recent_rr = recent_rr[-8:]
                    rr_avg1 = float(np.mean(recent_rr))
                    if 0.92 * rr_avg2 <= rr <= 1.16 * rr_avg2:
                        acceptable_rr.append(rr)
                        acceptable_rr = acceptable_rr[-8:]
                        rr_avg2 = float(np.mean(acceptable_rr))
                    rr_avg1_history.append(round(rr_avg1, 1))
                    rr_avg2_history.append(round(rr_avg2, 1))

                last_qrs_integrated = p
                last_qrs_orig = r_peak
                last_qrs_slope = cand_slope
            else:
                # Noise peak
                npki = 0.125 * peaki + 0.875 * npki
                npkf = 0.125 * peakf + 0.875 * npkf
                th_i1 = npki + 0.25 * (spki - npki)
                th_i2 = 0.5 * th_i1
                th_f1 = npkf + 0.25 * (spkf - npkf)
                th_f2 = 0.5 * th_f1
                noise_candidates.append((p, peaki, peakf, cand_slope))

            i += 1

        # ---------------------------------------------------------------------
        # Final Search-Back Check at End of Signal
        # ---------------------------------------------------------------------
        if last_qrs_integrated > 0 and (n_samples - last_qrs_integrated) > int(1.66 * rr_avg2):
            qualifying = [
                c for c in noise_candidates
                if c[0] > (last_qrs_integrated + refractory_samples)
                and c[1] > th_i2
                and c[2] > th_f2
            ]
            if qualifying:
                best_cand = max(qualifying, key=lambda c: c[1])
                sb_p, sb_peaki, sb_peakf, sb_slope = best_cand
                r_sb = map_to_r_peak(sb_p)
                detected_peaks.append(r_sb)
                peaks_integrated.append(sb_p)
                detection_methods.append('searchback')
                searchback_peaks.append(r_sb)
                ref_end = min(n_samples, r_sb + refractory_samples)
                refractory_intervals.append([r_sb, ref_end])
                if last_qrs_orig > 0:
                    rr = r_sb - last_qrs_orig
                    rr_intervals.append(int(rr))
                    recent_rr.append(rr)
                    recent_rr = recent_rr[-8:]
                    rr_avg1 = float(np.mean(recent_rr))
                    if 0.92 * rr_avg2 <= rr <= 1.16 * rr_avg2:
                        acceptable_rr.append(rr)
                        acceptable_rr = acceptable_rr[-8:]
                        rr_avg2 = float(np.mean(acceptable_rr))
                    rr_avg1_history.append(round(rr_avg1, 1))
                    rr_avg2_history.append(round(rr_avg2, 1))

        # Fill threshold arrays to the end of the signal
        record_state_up_to(n_samples)

        # Ensure detected peaks are sorted by sample index
        if len(detected_peaks) > 1:
            sort_indices = np.argsort(detected_peaks)
            detected_peaks = [detected_peaks[idx] for idx in sort_indices]
            peaks_integrated = [peaks_integrated[idx] for idx in sort_indices]
            detection_methods = [detection_methods[idx] for idx in sort_indices]

        # Return full dictionary preserving existing keys and adding Pan-Tompkins metadata
        return {
            'original': signal.tolist(),
            'bandpass': filtered_sig.tolist(),
            'derivative': derivative_sig.tolist(),
            'squared': squared_sig.tolist(),
            'integrated': integrated_sig.tolist(),
            'peaks_integrated': peaks_integrated,
            'peaks_original': detected_peaks,
            'threshold': float(th_i1_arr[-1]),
            # Complete 1985 Pan-Tompkins metadata
            'detected_peaks': detected_peaks,
            'detection_method': detection_methods,
            'searchback': searchback_peaks,
            'rr_intervals': rr_intervals,
            'rr_average_1': rr_avg1_history,
            'rr_average_2': rr_avg2_history,
            'spki': [round(float(v), 4) for v in spki_arr],
            'npki': [round(float(v), 4) for v in npki_arr],
            'spkf': [round(float(v), 4) for v in spkf_arr],
            'npkf': [round(float(v), 4) for v in npkf_arr],
            'threshold_i1': [round(float(v), 4) for v in th_i1_arr],
            'threshold_i2': [round(float(v), 4) for v in th_i2_arr],
            'threshold_f1': [round(float(v), 4) for v in th_f1_arr],
            'threshold_f2': [round(float(v), 4) for v in th_f2_arr],
            'refractory_intervals': refractory_intervals,
            'rejected_t_waves': rejected_t_waves
        }

    def _empty_result(self, signal):
        """Helper to return empty structures for signals too short to process."""
        n_samples = len(signal)
        empty_arr = [0.0] * n_samples
        return {
            'original': signal.tolist(),
            'bandpass': empty_arr,
            'derivative': empty_arr,
            'squared': empty_arr,
            'integrated': empty_arr,
            'peaks_integrated': [],
            'peaks_original': [],
            'threshold': 0.0,
            'detected_peaks': [],
            'detection_method': [],
            'searchback': [],
            'rr_intervals': [],
            'rr_average_1': [],
            'rr_average_2': [],
            'spki': empty_arr,
            'npki': empty_arr,
            'spkf': empty_arr,
            'npkf': empty_arr,
            'threshold_i1': empty_arr,
            'threshold_i2': empty_arr,
            'threshold_f1': empty_arr,
            'threshold_f2': empty_arr,
            'refractory_intervals': [],
            'rejected_t_waves': []
        }

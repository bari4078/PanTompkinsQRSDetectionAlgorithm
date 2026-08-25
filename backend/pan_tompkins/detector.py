import numpy as np
from scipy.signal import find_peaks
from .filters import BandpassFilter, DerivativeFilter, SquaringFilter, MovingWindowIntegration

class PanTompkinsDetector:
    """
    Facade Pattern: Provides a simplified, unified interface to the complex
    subsystem of signal processing filters and thresholding logic.
    Instead of the user calling 5 different filters manually, they just call
    detector.process().
    """
    def __init__(self, window_size_ms=150, filter_lowcut=5.0, filter_highcut=15.0):
        # Initialize our strategies (filters)
        self.bandpass = BandpassFilter(lowcut=filter_lowcut, highcut=filter_highcut)
        self.derivative = DerivativeFilter()
        self.squaring = SquaringFilter()
        self.integration = MovingWindowIntegration(window_size_ms=window_size_ms)

    def process(self, signal, fs):
        """
        Executes the Pan-Tompkins pipeline in sequential order.
        
        Args:
            signal (np.array): Original ECG signal.
            fs (int): Sampling frequency.
            
        Returns:
            dict: Contains all intermediate signals and the final detected peaks.
                  Data is converted to lists to be JSON serializable for the web API.
        """
        # Step 1: Bandpass Filter (Remove noise & baseline wander)
        filtered_sig = self.bandpass.apply(signal, fs)
        
        # Step 2: Derivative (Highlight steep slopes of QRS)
        derivative_sig = self.derivative.apply(filtered_sig, fs)
        
        # Step 3: Squaring (Make positive and amplify high frequencies)
        squared_sig = self.squaring.apply(derivative_sig, fs)
        
        # Step 4: Moving Window Integration (Gather QRS energy into single lumps)
        integrated_sig = self.integration.apply(squared_sig, fs)
        
        # Step 5: Peak Detection & Thresholding on the integrated signal
        # We use a simplified robust thresholding mechanism for novice readability.
        # It sets the threshold dynamically based on the signal's mean and std dev.
        threshold = np.mean(integrated_sig) + 0.5 * np.std(integrated_sig)
        
        # Minimum distance between peaks. 
        # A heart rate of 200 beats per minute means 3.3 beats per second.
        # So peaks can't be closer than ~0.3 seconds (300ms).
        min_distance = int(0.3 * fs) 
        
        # Find peaks that exceed the threshold and are spaced apart properly
        peaks, _ = find_peaks(integrated_sig, height=threshold, distance=min_distance)
        
        # We also need to map these peaks back to the original signal to find the exact R-peak.
        # The integration window causes a delay. We search in the original signal slightly
        # around the detected peak in the integrated signal.
        r_peaks = []
        search_window = int(0.15 * fs) # 150ms search window
        
        for p in peaks:
            start = max(0, p - search_window)
            end = min(len(signal), p + search_window)
            # Find the index of the maximum value in the original signal within this window
            local_max = np.argmax(signal[start:end])
            r_peaks.append(int(start + local_max))
        
        # Return all stages for the frontend visualization
        return {
            'original': signal.tolist(),
            'bandpass': filtered_sig.tolist(),
            'derivative': derivative_sig.tolist(),
            'squared': squared_sig.tolist(),
            'integrated': integrated_sig.tolist(),
            'peaks_integrated': peaks.tolist(), # Peaks on the integrated signal
            'peaks_original': r_peaks,          # Exact R-peaks on the original signal
            'threshold': float(threshold)
        }

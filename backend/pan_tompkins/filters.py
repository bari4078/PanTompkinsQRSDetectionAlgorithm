import numpy as np
from scipy.signal import butter, lfilter

class FilterStrategy:
    """
    Abstract Strategy Interface for all signal filters.
    In the Strategy Pattern, this defines the common interface
    for our family of algorithms (the different filter stages).
    """
    def apply(self, signal, fs):
        """
        Applies the filter to the signal.

        Args:
            signal (np.array): The input ECG signal.
            fs (int): The sampling frequency.
        Returns:
            np.array: The filtered signal.
        """
        raise NotImplementedError("Subclasses must implement the apply method.")


class BandpassFilter(FilterStrategy):
    """
    Concrete Strategy: Bandpass Filter.
    The Pan-Tompkins algorithm uses a bandpass filter (typically 5-15 Hz)
    to reduce baseline wander (low frequencies) and muscle noise (high frequencies).
    """
    def __init__(self, lowcut=5.0, highcut=15.0, order=1):
        self.lowcut = lowcut
        self.highcut = highcut
        self.order = order

    def apply(self, signal, fs):
        nyquist = 0.5 * fs
        low = self.lowcut / nyquist
        high = self.highcut / nyquist

        # Create a Butterworth bandpass filter
        b, a = butter(self.order, [low, high], btype='band')

        # Apply the filter to the signal
        return lfilter(b, a, signal)


class DerivativeFilter(FilterStrategy):
    """
    Concrete Strategy: Derivative Filter.
    This filter differentiates the signal to highlight the steep slopes
    characteristic of QRS complexes.
    """
    def apply(self, signal, fs):
        # The standard Pan-Tompkins derivative filter coefficients:
        # y[n] = (1/8T) * (-x[n-2] - 2x[n-1] + 2x[n+1] + x[n+2])
        # In np.convolve, the kernel is flipped during computation.
        # Therefore, h_d = [1/8, 2/8, 0, -2/8, -1/8] yields:
        # -x[n-2]/8 - 2x[n-1]/8 + 0 + 2x[n+1]/8 + x[n+2]/8

        h_d = [1/8, 2/8, 0, -2/8, -1/8]
        derivative = np.convolve(signal, h_d, mode='same')

        # Multiply by fs to account for the (1/T) factor
        return derivative * fs


class SquaringFilter(FilterStrategy):
    """
    Concrete Strategy: Squaring Filter.
    This squares the signal pointwise. It makes all points positive
    and non-linearly amplifies the higher frequencies (the steep QRS slopes).
    """
    def apply(self, signal, fs):
        return np.square(signal)


class MovingWindowIntegration(FilterStrategy):
    """
    Concrete Strategy: Moving Window Integration.
    This acts as a smoothing filter. It slides a window across the signal
    and averages the values, producing a single distinct lump for each QRS complex.
    """
    def __init__(self, window_size_ms=150):
        # Window size is typically 150ms. Too small: multiple peaks per QRS.
        # Too large: merges QRS with T waves.
        self.window_size_ms = window_size_ms

    def apply(self, signal, fs):
        # Convert window size from milliseconds to number of samples
        window_size = int((self.window_size_ms / 1000.0) * fs)

        # Ensure window_size is at least 1
        if window_size < 1:
            window_size = 1

        # Create a window of evenly distributed weights
        window = np.ones(window_size) / window_size

        # Apply convolution to perform the moving average
        integrated = np.convolve(signal, window, mode='same')
        return integrated

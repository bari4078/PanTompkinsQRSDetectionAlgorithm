# Code Line-by-Line Explanation

This document provides a detailed explanation of the core signal processing logic found in `backend/pan_tompkins/filters.py` and `backend/pan_tompkins/detector.py`.

---

## 1. BandpassFilter

```python
class BandpassFilter(FilterStrategy):
    # ... init method ...
    def apply(self, signal, fs):
        nyquist = 0.5 * fs
        low = self.lowcut / nyquist
        high = self.highcut / nyquist
        
        b, a = butter(self.order, [low, high], btype='band')
        return lfilter(b, a, signal)
```
* **`nyquist = 0.5 * fs`**: The Nyquist frequency is exactly half of the sampling rate (`fs`). It represents the maximum frequency that can be accurately represented in our digital signal.
* **`low = self.lowcut / nyquist`** and **`high = self.highcut / nyquist`**: Digital filters require frequencies to be normalized (scaled) between 0 and 1, where 1 is the Nyquist frequency. We scale our 5 Hz and 15 Hz targets.
* **`b, a = butter(self.order, [low, high], btype='band')`**: This creates a "Butterworth" bandpass filter. It calculates two sets of mathematical coefficients (`b` and `a`) that define the filter's behavior.
* **`lfilter(b, a, signal)`**: This applies the calculated `b` and `a` coefficients to our actual ECG `signal`, spitting out the filtered result.

---

## 2. DerivativeFilter

```python
class DerivativeFilter(FilterStrategy):
    def apply(self, signal, fs):
        h_d = [-1/8, -2/8, 0, 2/8, 1/8] 
        derivative = np.convolve(signal, h_d, mode='same')
        return derivative * fs
```
* **`h_d = [-1/8, -2/8, 0, 2/8, 1/8]`**: This is a standard 5-point derivative kernel (or mask). It essentially looks at two points in the past, ignores the current point (`0`), and looks at two points in the future to calculate the slope.
* **`np.convolve(signal, h_d, mode='same')`**: Convolution slides our `h_d` kernel across the entire `signal`. At every point, it multiplies the signal values by the kernel values and sums them up. The `mode='same'` ensures the output array is the same length as the input.
* **`derivative * fs`**: In calculus, a derivative divides by the change in time (`dt`). In digital signals, `dt` is `1/fs`. Dividing by `1/fs` is the same as multiplying by `fs`.

---

## 3. MovingWindowIntegration

```python
class MovingWindowIntegration(FilterStrategy):
    def apply(self, signal, fs):
        window_size = int((self.window_size_ms / 1000.0) * fs)
        window = np.ones(window_size) / window_size
        integrated = np.convolve(signal, window, mode='same')
        return integrated
```
* **`window_size = int((self.window_size_ms / 1000.0) * fs)`**: We convert our window size from milliseconds (e.g., 150ms) to seconds (0.15s), and then multiply by the sampling frequency to figure out how many "data points" (samples) make up that window.
* **`window = np.ones(window_size) / window_size`**: This creates an array of 1s, and divides each by the total size. E.g., if the size is 5, the array is `[0.2, 0.2, 0.2, 0.2, 0.2]`. 
* **`np.convolve(signal, window, mode='same')`**: When you convolve a signal with an array of equal fractions like the one above, it mathematically performs a "Moving Average." It averages all the points within the window, smoothing out the signal.

---

## 4. Peak Detection (in `detector.py`)

```python
threshold = np.mean(integrated_sig) + 0.5 * np.std(integrated_sig)
min_distance = int(0.3 * fs) 
peaks, _ = find_peaks(integrated_sig, height=threshold, distance=min_distance)
```
* **`threshold = np.mean(...) + 0.5 * np.std(...)`**: We calculate the average (mean) height of the integrated signal, and add half of its standard deviation (how spread out the data is). This creates a dynamic horizontal line.
* **`min_distance = int(0.3 * fs)`**: 0.3 seconds is the minimum time between heartbeats (max 200 beats per minute). We multiply by `fs` to convert this to data points.
* **`find_peaks(...)`**: This SciPy function sweeps through the signal. It finds local maximums that are higher than our `threshold`, ensuring they are at least `min_distance` apart from each other. It returns the indices (positions) of these peaks.

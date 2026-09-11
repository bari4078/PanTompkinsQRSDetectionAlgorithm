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

## 4. Adaptive Detection & Decision Rules (in `detector.py`)

```python
# Dual adaptive thresholding
th_i1 = npki + 0.25 * (spki - npki)
th_i2 = 0.5 * th_i1
th_f1 = npkf + 0.25 * (spkf - npkf)
th_f2 = 0.5 * th_f1
```
* **Dual Signal Path**: Tracks signal and noise peak levels on both the moving-window integrated signal (`SPKI`, `NPKI`) and bandpass-filtered signal (`SPKF`, `NPKF`).
* **Dual Thresholds**: Primary thresholds (`THRESHOLD_I1`, `THRESHOLD_F1`) and secondary search-back thresholds (`THRESHOLD_I2`, `THRESHOLD_F2`).
* **200 ms Refractory Period**: Physiologically blanks candidate peaks occurring within 200 ms of a confirmed QRS.
* **T-Wave Discrimination**: Compares derivative slope for candidate peaks within 200–360 ms. If candidate slope < 0.5 × previous QRS slope, it is rejected as a T-wave.
* **Search-Back**: If no QRS is detected within 166% of `RR_AVERAGE2`, the algorithm searches back for missed peaks exceeding the secondary thresholds (`THRESHOLD_I2` and `THRESHOLD_F2`).
* **RR Interval Adaptation**: Continuously tracks `RR_AVERAGE1` (recent 8 beats) and `RR_AVERAGE2` (acceptable 8 beats between 92% and 116% limits).

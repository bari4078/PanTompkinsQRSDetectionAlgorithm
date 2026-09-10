/**
 * Core utility for locating the current position within the series of detected R-peaks.
 */

/**
 * resolveBeat(currentSampleIndex, rPeaks, fs)
 * 
 * @param {number} currentSampleIndex - current position in samples
 * @param {number[]} rPeaks - array of R-peak sample indices (sorted ascending)
 * @param {number} fs - sampling frequency
 * @returns {{ prevPeakIndex: number|null, nextPeakIndex: number|null, beatIndex: number|null, relativeTimeSec: number }}
 *   - prevPeakIndex: index into rPeaks array for the previous peak (or null if before first)
 *   - nextPeakIndex: index into rPeaks array for the next peak (or null if after last)
 *   - beatIndex: which beat we're in (0-based), null if before first peak
 *   - relativeTimeSec: time in seconds from the nearest R-peak (negative = before, positive = after)
 */
export function resolveBeat(currentSampleIndex, rPeaks, fs) {
  if (!rPeaks || rPeaks.length === 0) {
    return { prevPeakIndex: null, nextPeakIndex: null, beatIndex: null, relativeTimeSec: 0 };
  }

  let left = 0;
  let right = rPeaks.length - 1;
  let mid = 0;

  // Binary search to find nearest peaks
  while (left <= right) {
    mid = Math.floor((left + right) / 2);
    if (rPeaks[mid] === currentSampleIndex) {
      return {
        prevPeakIndex: mid,
        nextPeakIndex: mid,
        beatIndex: mid,
        relativeTimeSec: 0
      };
    } else if (rPeaks[mid] < currentSampleIndex) {
      left = mid + 1;
    } else {
      right = mid - 1;
    }
  }

  // After loop, 'right' is largest index < currentSampleIndex
  // 'left' is smallest index > currentSampleIndex
  
  let prevPeakIndex = right >= 0 ? right : null;
  let nextPeakIndex = left < rPeaks.length ? left : null;
  
  let beatIndex = prevPeakIndex;
  let relativeTimeSec = 0;
  
  if (prevPeakIndex === null) {
    // Before first peak
    relativeTimeSec = (currentSampleIndex - rPeaks[nextPeakIndex]) / fs;
  } else if (nextPeakIndex === null) {
    // After last peak
    relativeTimeSec = (currentSampleIndex - rPeaks[prevPeakIndex]) / fs;
  } else {
    // Between two peaks, find closest
    const distPrev = currentSampleIndex - rPeaks[prevPeakIndex];
    const distNext = rPeaks[nextPeakIndex] - currentSampleIndex;
    if (distPrev <= distNext) {
      relativeTimeSec = distPrev / fs;
    } else {
      relativeTimeSec = -distNext / fs;
    }
  }
  
  return { prevPeakIndex, nextPeakIndex, beatIndex, relativeTimeSec };
}

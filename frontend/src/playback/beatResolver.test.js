import { describe, it, expect } from 'vitest';
import { resolveBeat } from './beatResolver';

const FS = 360; // Standard MIT-BIH sampling frequency

describe('resolveBeat', () => {
  describe('empty rPeaks', () => {
    it('returns all nulls with relativeTime 0', () => {
      const result = resolveBeat(500, [], FS);
      expect(result.prevPeakIndex).toBeNull();
      expect(result.nextPeakIndex).toBeNull();
      expect(result.beatIndex).toBeNull();
      expect(result.relativeTimeSec).toBe(0);
    });

    it('handles null rPeaks', () => {
      const result = resolveBeat(500, null, FS);
      expect(result.prevPeakIndex).toBeNull();
      expect(result.nextPeakIndex).toBeNull();
    });
  });

  describe('single R-peak', () => {
    const peaks = [500];

    it('before the peak → prevPeakIndex null, nextPeakIndex 0', () => {
      const result = resolveBeat(200, peaks, FS);
      expect(result.prevPeakIndex).toBeNull();
      expect(result.nextPeakIndex).toBe(0);
      expect(result.beatIndex).toBeNull();
      // relativeTime should be negative (approaching the peak)
      expect(result.relativeTimeSec).toBeLessThan(0);
    });

    it('exactly at the peak → both indices point to 0', () => {
      const result = resolveBeat(500, peaks, FS);
      expect(result.prevPeakIndex).toBe(0);
      expect(result.nextPeakIndex).toBe(0);
      expect(result.beatIndex).toBe(0);
      expect(result.relativeTimeSec).toBe(0);
    });

    it('after the peak → prevPeakIndex 0, nextPeakIndex null', () => {
      const result = resolveBeat(800, peaks, FS);
      expect(result.prevPeakIndex).toBe(0);
      expect(result.nextPeakIndex).toBeNull();
      expect(result.beatIndex).toBe(0);
      expect(result.relativeTimeSec).toBeGreaterThan(0);
    });
  });

  describe('multiple R-peaks', () => {
    // Simulate ~72 BPM (RR interval ≈ 300 samples at 360Hz ≈ 0.833s)
    const peaks = [342, 642, 942, 1242, 1542];

    it('before first peak', () => {
      const result = resolveBeat(100, peaks, FS);
      expect(result.prevPeakIndex).toBeNull();
      expect(result.nextPeakIndex).toBe(0);
      expect(result.beatIndex).toBeNull();
      // 100 - 342 = -242 samples → -242/360 ≈ -0.672s
      expect(result.relativeTimeSec).toBeCloseTo(-242 / FS, 3);
    });

    it('after last peak', () => {
      const result = resolveBeat(1800, peaks, FS);
      expect(result.prevPeakIndex).toBe(4);
      expect(result.nextPeakIndex).toBeNull();
      expect(result.beatIndex).toBe(4);
      // 1800 - 1542 = 258 samples → 258/360 ≈ 0.717s
      expect(result.relativeTimeSec).toBeCloseTo(258 / FS, 3);
    });

    it('exactly at a middle peak', () => {
      const result = resolveBeat(942, peaks, FS);
      expect(result.prevPeakIndex).toBe(2);
      expect(result.nextPeakIndex).toBe(2);
      expect(result.beatIndex).toBe(2);
      expect(result.relativeTimeSec).toBe(0);
    });

    it('between two peaks, closer to previous', () => {
      // 342 + 100 = 442, closer to 342 (100 away) than to 642 (200 away)
      const result = resolveBeat(442, peaks, FS);
      expect(result.prevPeakIndex).toBe(0);
      expect(result.nextPeakIndex).toBe(1);
      expect(result.beatIndex).toBe(0);
      // Closer to prev peak → positive relative time
      expect(result.relativeTimeSec).toBeCloseTo(100 / FS, 3);
    });

    it('between two peaks, closer to next', () => {
      // 642 - 50 = 592, closer to 642 (50 away) than to 342 (250 away)
      const result = resolveBeat(592, peaks, FS);
      expect(result.prevPeakIndex).toBe(0);
      expect(result.nextPeakIndex).toBe(1);
      // Closer to next peak → negative relative time
      expect(result.relativeTimeSec).toBeCloseTo(-50 / FS, 3);
    });

    it('exactly midpoint between two peaks', () => {
      // Midpoint of 342 and 642 = 492
      const result = resolveBeat(492, peaks, FS);
      expect(result.prevPeakIndex).toBe(0);
      expect(result.nextPeakIndex).toBe(1);
      // Both equidistant — should prefer prev (<=)
      expect(result.relativeTimeSec).toBeCloseTo(150 / FS, 3);
    });
  });

  describe('irregular R-peak intervals', () => {
    // Simulate varying heart rate
    const peaks = [200, 600, 850, 1400];

    it('correctly brackets in short RR interval', () => {
      // Between 600 and 850 (short interval)
      const result = resolveBeat(700, peaks, FS);
      expect(result.prevPeakIndex).toBe(1);
      expect(result.nextPeakIndex).toBe(2);
    });

    it('correctly brackets in long RR interval', () => {
      // Between 850 and 1400 (long interval)
      const result = resolveBeat(1100, peaks, FS);
      expect(result.prevPeakIndex).toBe(2);
      expect(result.nextPeakIndex).toBe(3);
    });
  });

  describe('edge cases', () => {
    it('sample at index 0', () => {
      const result = resolveBeat(0, [100, 400], FS);
      expect(result.prevPeakIndex).toBeNull();
      expect(result.nextPeakIndex).toBe(0);
    });

    it('two adjacent peaks', () => {
      const result = resolveBeat(101, [100, 102], FS);
      expect(result.prevPeakIndex).toBe(0);
      expect(result.nextPeakIndex).toBe(1);
    });
  });
});

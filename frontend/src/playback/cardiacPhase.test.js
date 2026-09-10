import { describe, it, expect } from 'vitest';
import { resolveCardiacPhase, CARDIAC_PHASES } from './cardiacPhase';

const FS = 360;

describe('resolveCardiacPhase', () => {
  describe('CARDIAC_PHASES constant', () => {
    it('exports phase boundaries', () => {
      expect(CARDIAC_PHASES.atrial_activation).toBeDefined();
      expect(CARDIAC_PHASES.av_delay).toBeDefined();
      expect(CARDIAC_PHASES.ventricular_conduction).toBeDefined();
      expect(CARDIAC_PHASES.repolarization).toBeDefined();
    });

    it('phases are in chronological order', () => {
      expect(CARDIAC_PHASES.atrial_activation.end).toBeLessThanOrEqual(CARDIAC_PHASES.av_delay.start);
      expect(CARDIAC_PHASES.av_delay.end).toBeLessThanOrEqual(CARDIAC_PHASES.ventricular_conduction.start);
      expect(CARDIAC_PHASES.ventricular_conduction.end).toBeLessThanOrEqual(CARDIAC_PHASES.repolarization.start);
    });
  });

  describe('no R-peaks', () => {
    it('returns diastole with progress 0', () => {
      const result = resolveCardiacPhase(500, [], FS);
      expect(result.phase).toBe('diastole');
      expect(result.progress).toBe(0);
    });
  });

  describe('phase classification around a single R-peak', () => {
    // R-peak at sample 1000
    const peaks = [1000];

    it('200ms before R → atrial_activation, progress ≈ 0', () => {
      // -0.20s * 360 = -72 samples → sample 928
      const sample = 1000 - Math.round(0.20 * FS);
      const result = resolveCardiacPhase(sample, peaks, FS);
      expect(result.phase).toBe('atrial_activation');
      expect(result.progress).toBeCloseTo(0, 1);
    });

    it('160ms before R → atrial_activation, progress ≈ 0.5', () => {
      // -0.16s * 360 = -57.6 → sample 942 (midpoint of -0.20 to -0.12)
      const sample = 1000 - Math.round(0.16 * FS);
      const result = resolveCardiacPhase(sample, peaks, FS);
      expect(result.phase).toBe('atrial_activation');
      expect(result.progress).toBeGreaterThan(0.3);
      expect(result.progress).toBeLessThan(0.7);
    });

    it('120ms before R → boundary of atrial_activation/av_delay', () => {
      const sample = 1000 - Math.round(0.12 * FS);
      const result = resolveCardiacPhase(sample, peaks, FS);
      // Should be at the end of atrial_activation or start of av_delay
      expect(['atrial_activation', 'av_delay']).toContain(result.phase);
    });

    it('80ms before R → av_delay', () => {
      const sample = 1000 - Math.round(0.08 * FS);
      const result = resolveCardiacPhase(sample, peaks, FS);
      expect(result.phase).toBe('av_delay');
      expect(result.progress).toBeGreaterThan(0.3);
      expect(result.progress).toBeLessThan(0.7);
    });

    it('40ms before R → boundary of av_delay/ventricular_conduction', () => {
      const sample = 1000 - Math.round(0.04 * FS);
      const result = resolveCardiacPhase(sample, peaks, FS);
      expect(['av_delay', 'ventricular_conduction']).toContain(result.phase);
    });

    it('exactly at R-peak → ventricular_conduction', () => {
      const result = resolveCardiacPhase(1000, peaks, FS);
      expect(result.phase).toBe('ventricular_conduction');
      // At relativeTime=0, progress should be 0.04/0.10 = 0.4 (since start=-0.04, end=0.06)
      expect(result.progress).toBeGreaterThan(0.3);
      expect(result.progress).toBeLessThan(0.5);
    });

    it('50ms after R → near end of ventricular_conduction', () => {
      const sample = 1000 + Math.round(0.05 * FS);
      const result = resolveCardiacPhase(sample, peaks, FS);
      expect(result.phase).toBe('ventricular_conduction');
      expect(result.progress).toBeGreaterThan(0.8);
    });

    it('80ms after R → diastole (ST segment gap)', () => {
      // Between +0.06 and +0.10 is the ST segment gap → diastole
      const sample = 1000 + Math.round(0.08 * FS);
      const result = resolveCardiacPhase(sample, peaks, FS);
      expect(result.phase).toBe('diastole');
    });

    it('200ms after R → repolarization', () => {
      const sample = 1000 + Math.round(0.20 * FS);
      const result = resolveCardiacPhase(sample, peaks, FS);
      expect(result.phase).toBe('repolarization');
      expect(result.progress).toBeGreaterThan(0.3);
      expect(result.progress).toBeLessThan(0.5);
    });

    it('350ms after R → end of repolarization', () => {
      const sample = 1000 + Math.round(0.35 * FS);
      const result = resolveCardiacPhase(sample, peaks, FS);
      expect(['repolarization', 'diastole']).toContain(result.phase);
    });

    it('500ms after R → diastole', () => {
      const sample = 1000 + Math.round(0.50 * FS);
      const result = resolveCardiacPhase(sample, peaks, FS);
      expect(result.phase).toBe('diastole');
    });
  });

  describe('progress is always 0-1', () => {
    const peaks = [500, 1000, 1500];

    it('progress is between 0 and 1 for all test samples', () => {
      for (let sample = 0; sample < 2000; sample += 10) {
        const result = resolveCardiacPhase(sample, peaks, FS);
        expect(result.progress).toBeGreaterThanOrEqual(0);
        expect(result.progress).toBeLessThanOrEqual(1);
      }
    });
  });

  describe('seek before first peak', () => {
    const peaks = [1000, 1500];

    it('at sample 0, far from any peak → diastole', () => {
      const result = resolveCardiacPhase(0, peaks, FS);
      expect(result.phase).toBe('diastole');
      expect(result.beatIndex).toBeNull();
    });

    it('approaching first peak → atrial_activation', () => {
      // 150ms before first peak
      const sample = 1000 - Math.round(0.15 * FS);
      const result = resolveCardiacPhase(sample, peaks, FS);
      expect(result.phase).toBe('atrial_activation');
    });
  });

  describe('seek after last peak', () => {
    const peaks = [500, 1000];

    it('well after last peak → diastole', () => {
      const result = resolveCardiacPhase(2000, peaks, FS);
      expect(result.phase).toBe('diastole');
      expect(result.beatIndex).toBe(1);
    });

    it('shortly after last peak → repolarization', () => {
      const sample = 1000 + Math.round(0.20 * FS);
      const result = resolveCardiacPhase(sample, peaks, FS);
      expect(result.phase).toBe('repolarization');
    });
  });

  describe('output shape', () => {
    it('returns all expected fields', () => {
      const result = resolveCardiacPhase(500, [400, 800], FS);
      expect(result).toHaveProperty('phase');
      expect(result).toHaveProperty('progress');
      expect(result).toHaveProperty('beatIndex');
      expect(result).toHaveProperty('prevPeakIndex');
      expect(result).toHaveProperty('nextPeakIndex');
    });
  });
});

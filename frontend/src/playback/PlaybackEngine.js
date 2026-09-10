/**
 * Core engine for managing playback state without React dependencies.
 */

import { resolveCardiacPhase } from './cardiacPhase';

export class PlaybackEngine {
  constructor({ fs, rPeaks, duration }) {
    this.fs = fs;
    this.rPeaks = rPeaks || [];
    this.duration = duration || 0;
    
    this.currentTime = 0;
    this.isPlaying = false;
    this.playbackRate = 1;
    
    this._updateState();
  }
  
  play() {
    if (this.currentTime >= this.duration) {
      this.currentTime = 0;
    }
    this.isPlaying = true;
  }
  
  pause() {
    this.isPlaying = false;
  }
  
  stop() {
    this.pause();
    this.seek(0);
  }
  
  seek(timeSec) {
    this.currentTime = Math.max(0, Math.min(timeSec, this.duration));
    this._updateState();
  }
  
  setPlaybackRate(rate) {
    this.playbackRate = rate;
  }
  
  stepSample(direction) {
    this.pause();
    const currentSample = Math.floor(this.currentTime * this.fs);
    const newSample = Math.max(0, Math.min(currentSample + direction, Math.floor(this.duration * this.fs)));
    this.seek(newSample / this.fs);
  }
  
  stepBeat(direction) {
    this.pause();
    if (this.rPeaks.length === 0) return;
    
    const currentSample = Math.floor(this.currentTime * this.fs);
    let targetPeak = null;
    
    if (direction > 0) {
      // jump to next peak
      for (let i = 0; i < this.rPeaks.length; i++) {
        if (this.rPeaks[i] > currentSample) {
          targetPeak = this.rPeaks[i];
          break;
        }
      }
    } else {
      // jump to previous peak
      for (let i = this.rPeaks.length - 1; i >= 0; i--) {
        if (this.rPeaks[i] < currentSample) {
          targetPeak = this.rPeaks[i];
          break;
        }
      }
    }
    
    if (targetPeak !== null) {
      this.seek(targetPeak / this.fs);
    }
  }
  
  tick(deltaTime) {
    if (!this.isPlaying) return;
    
    this.currentTime += deltaTime * this.playbackRate;
    
    if (this.currentTime >= this.duration) {
      this.currentTime = this.duration;
      this.pause();
    }
    
    this._updateState();
  }
  
  _updateState() {
    this.currentSampleIndex = Math.floor(this.currentTime * this.fs);
    
    const phaseInfo = resolveCardiacPhase(this.currentSampleIndex, this.rPeaks, this.fs);
    this.phase = phaseInfo.phase;
    this.phaseProgress = phaseInfo.progress;
    this.beatIndex = phaseInfo.beatIndex;
    this.prevPeakIndex = phaseInfo.prevPeakIndex;
    this.nextPeakIndex = phaseInfo.nextPeakIndex;
    
    this.heartRate = null;
    if (this.prevPeakIndex !== null && this.nextPeakIndex !== null && this.prevPeakIndex !== this.nextPeakIndex) {
      const rrIntervalSamples = this.rPeaks[this.nextPeakIndex] - this.rPeaks[this.prevPeakIndex];
      const rrIntervalSec = rrIntervalSamples / this.fs;
      if (rrIntervalSec > 0) {
        this.heartRate = 60 / rrIntervalSec;
      }
    }
  }
  
  getState() {
    return {
      currentTime: this.currentTime,
      currentSampleIndex: this.currentSampleIndex,
      isPlaying: this.isPlaying,
      playbackRate: this.playbackRate,
      phase: this.phase,
      phaseProgress: this.phaseProgress,
      beatIndex: this.beatIndex,
      prevPeakIndex: this.prevPeakIndex,
      nextPeakIndex: this.nextPeakIndex,
      heartRate: this.heartRate
    };
  }
}

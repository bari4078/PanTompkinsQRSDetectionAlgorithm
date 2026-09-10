/**
 * React hook to bridge PlaybackEngine with the React rendering cycle.
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { PlaybackEngine } from './PlaybackEngine';

export function usePlaybackEngine({ fs, rPeaks, duration }) {
  const engineRef = useRef(null);
  const rafRef = useRef(null);
  const lastTimeRef = useRef(null);
  
  const [state, setState] = useState(() => {
    engineRef.current = new PlaybackEngine({ fs, rPeaks, duration });
    return engineRef.current.getState();
  });

  // Re-initialize engine if config changes
  useEffect(() => {
    engineRef.current = new PlaybackEngine({ fs, rPeaks, duration });
    setState(engineRef.current.getState());
  }, [fs, rPeaks, duration]);

  const tick = useCallback((timestamp) => {
    if (lastTimeRef.current != null) {
      const deltaSec = (timestamp - lastTimeRef.current) / 1000;
      engineRef.current.tick(deltaSec);
      setState(engineRef.current.getState());
    }
    
    lastTimeRef.current = timestamp;
    if (engineRef.current.getState().isPlaying) {
      rafRef.current = requestAnimationFrame(tick);
    }
  }, []);

  useEffect(() => {
    if (state.isPlaying) {
      // Start RAF loop if playing
      if (lastTimeRef.current === null) {
          lastTimeRef.current = performance.now();
      }
      rafRef.current = requestAnimationFrame(tick);
    } else {
      // Stop RAF loop if paused/stopped
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
      lastTimeRef.current = null;
    }
    
    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [state.isPlaying, tick]);

  const play = useCallback(() => {
    engineRef.current.play();
    setState(engineRef.current.getState());
  }, []);

  const pause = useCallback(() => {
    engineRef.current.pause();
    setState(engineRef.current.getState());
  }, []);

  const stop = useCallback(() => {
    engineRef.current.stop();
    setState(engineRef.current.getState());
  }, []);

  const seek = useCallback((timeSec) => {
    engineRef.current.seek(timeSec);
    setState(engineRef.current.getState());
  }, []);

  const setPlaybackRate = useCallback((rate) => {
    engineRef.current.setPlaybackRate(rate);
    setState(engineRef.current.getState());
  }, []);

  const stepSample = useCallback((direction) => {
    engineRef.current.stepSample(direction);
    setState(engineRef.current.getState());
  }, []);

  const stepBeat = useCallback((direction) => {
    engineRef.current.stepBeat(direction);
    setState(engineRef.current.getState());
  }, []);

  return [
    state,
    { play, pause, stop, seek, setPlaybackRate, stepSample, stepBeat }
  ];
}

import React from 'react';
import {
  Play,
  Pause,
  Square,
  SkipBack,
  SkipForward,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

/**
 * PlaybackControls
 *
 * A playback transport bar with speed selector and timeline slider for ECG & cardiac conduction visualization.
 *
 * @param {Object} props
 * @param {Object} props.state - Current playback state { currentTime, isPlaying, playbackRate }
 * @param {Object} props.controls - Transport controls { play, pause, stop, seek, setPlaybackRate, stepSample, stepBeat }
 * @param {number} props.duration - Total signal duration in seconds
 */
export default function PlaybackControls({ state = {}, controls = {}, duration = 0 }) {
  const {
    currentTime = 0,
    isPlaying = false,
    playbackRate = 1,
  } = state;

  const {
    play = () => {},
    pause = () => {},
    stop = () => {},
    seek = () => {},
    setPlaybackRate = () => {},
    stepSample = () => {},
    stepBeat = () => {},
  } = controls;

  // Available speed options
  const SPEED_OPTIONS = [0.1, 0.25, 0.5, 1];

  // Toggle between play and pause
  const handleTogglePlay = () => {
    if (isPlaying) {
      pause();
    } else {
      play();
    }
  };

  // Range slider handler: seek to chosen timestamp and pause playback
  const handleSliderChange = (e) => {
    const nextTime = parseFloat(e.target.value);
    seek(nextTime);
    pause();
  };

  // Base button styles matching dark theme UI specifications
  const baseButtonStyle = {
    background: '#0f172a',
    border: '1px solid #334155',
    color: '#f8fafc',
    borderRadius: '6px',
    padding: '6px 8px',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '5px',
    fontSize: '0.8rem',
    fontWeight: 500,
    lineHeight: 1,
    transition: 'background-color 0.15s ease, border-color 0.15s ease, transform 0.1s ease',
    userSelect: 'none',
    boxSizing: 'border-box',
  };

  // Highlighted play button
  const playButtonStyle = {
    ...baseButtonStyle,
    background: '#10b981',
    borderColor: '#10b981',
    color: '#ffffff',
    padding: '7px 10px',
    fontWeight: 600,
    width: '100%',
  };

  // Stop button
  const stopButtonStyle = {
    ...baseButtonStyle,
    background: '#ef4444',
    borderColor: '#ef4444',
    color: '#ffffff',
    padding: '7px 10px',
    fontWeight: 600,
    width: '100%',
  };

  // Determine speed button styling depending on active playback rate
  const getSpeedButtonStyle = (rate) => {
    const isActive = Math.abs(playbackRate - rate) < 0.001;
    return {
      ...baseButtonStyle,
      padding: '5px 2px',
      fontSize: '0.78rem',
      fontWeight: isActive ? 600 : 500,
      background: isActive ? '#3b82f6' : '#0f172a',
      borderColor: isActive ? '#3b82f6' : '#334155',
      color: '#ffffff',
      width: '100%',
      textAlign: 'center',
    };
  };

  return (
    <div
      style={{
        background: 'transparent',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5rem',
        width: '100%',
      }}
    >
      {/* Row 1: Play / Pause & Stop primary actions */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '6px',
          width: '100%',
        }}
      >
        {/* Play / Pause toggle */}
        <button
          type="button"
          style={playButtonStyle}
          onClick={handleTogglePlay}
          title={isPlaying ? 'Pause playback' : 'Start playback'}
          aria-label={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? (
            <>
              <Pause size={15} />
              <span>Pause</span>
            </>
          ) : (
            <>
              <Play size={15} fill="currentColor" />
              <span>Play</span>
            </>
          )}
        </button>

        {/* Stop (reset to beginning) */}
        <button
          type="button"
          style={stopButtonStyle}
          onClick={stop}
          title="Stop and reset to beginning"
          aria-label="Stop playback"
        >
          <Square size={13} fill="currentColor" />
          <span>Stop</span>
        </button>
      </div>

      {/* Row 2: Step & Beat navigation buttons */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '4px',
          width: '100%',
        }}
      >
        {/* |◀ : stepBeat(-1) — jump to previous R-peak */}
        <button
          type="button"
          style={{ ...baseButtonStyle, width: '100%', padding: '6px 0' }}
          onClick={() => stepBeat(-1)}
          title="Previous Beat (Jump to previous R-peak)"
          aria-label="Previous beat"
        >
          <SkipBack size={15} />
        </button>

        {/* ◀ : stepSample(-1) — step back one sample */}
        <button
          type="button"
          style={{ ...baseButtonStyle, width: '100%', padding: '6px 0' }}
          onClick={() => stepSample(-1)}
          title="Step back one sample"
          aria-label="Step back one sample"
        >
          <ChevronLeft size={15} />
        </button>

        {/* ▶ : stepSample(+1) — step forward one sample */}
        <button
          type="button"
          style={{ ...baseButtonStyle, width: '100%', padding: '6px 0' }}
          onClick={() => stepSample(1)}
          title="Step forward one sample"
          aria-label="Step forward one sample"
        >
          <ChevronRight size={15} />
        </button>

        {/* ▶| : stepBeat(+1) — jump to next R-peak */}
        <button
          type="button"
          style={{ ...baseButtonStyle, width: '100%', padding: '6px 0' }}
          onClick={() => stepBeat(1)}
          title="Next Beat (Jump to next R-peak)"
          aria-label="Next beat"
        >
          <SkipForward size={15} />
        </button>
      </div>

      {/* Row 3: Speed selector buttons (compact grid, decreased gap) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '4px',
          width: '100%',
        }}
      >
        {SPEED_OPTIONS.map((rate) => (
          <button
            key={rate}
            type="button"
            style={getSpeedButtonStyle(rate)}
            onClick={() => setPlaybackRate(rate)}
            title={`Playback speed ${rate}×`}
            aria-label={`Playback speed ${rate}x`}
          >
            {rate}×
          </button>
        ))}
      </div>

      {/* Row 4: Timeline slider */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          width: '100%',
          marginTop: '0.1rem',
        }}
      >
        <input
          type="range"
          min={0}
          max={duration || 0}
          step={0.001}
          value={Number.isFinite(currentTime) ? currentTime : 0}
          onChange={handleSliderChange}
          style={{
            width: '100%',
            accentColor: '#3b82f6',
            cursor: 'pointer',
            height: '6px',
            borderRadius: '3px',
            background: '#334155',
            outline: 'none',
          }}
          aria-label="Timeline scrubber"
        />
      </div>
    </div>
  );
}

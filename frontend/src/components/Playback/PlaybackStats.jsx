import React from 'react';

/**
 * Helper function to convert a snake_case phase string to Title Case.
 * Example: 'ventricular_conduction' -> 'Ventricular Conduction'
 *
 * @param {string} phase
 * @returns {string}
 */
function formatPhase(phase) {
  if (!phase) return '--';
  return phase.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

/**
 * PlaybackStats
 *
 * Displays current playback statistics in a horizontal stats bar with dividers.
 *
 * @param {Object} props
 * @param {Object} props.state - Playback status { currentTime, currentSampleIndex, phase, phaseProgress, beatIndex, heartRate }
 * @param {number} props.duration - Total signal duration in seconds
 * @param {number} props.totalBeats - Total number of R-peaks
 */
export default function PlaybackStats({ state = {}, duration = 0, totalBeats = 0 }) {
  const {
    currentTime = 0,
    currentSampleIndex,
    phase,
    phaseProgress = 0,
    beatIndex,
    heartRate,
  } = state;

  // Time: toFixed(3) for current, toFixed(1) for duration
  const safeCurrentTime = Number.isFinite(currentTime) ? currentTime : 0;
  const safeDuration = Number.isFinite(duration) ? duration : 0;
  const formattedTime = `${safeCurrentTime.toFixed(3)}s / ${safeDuration.toFixed(1)}s`;

  // Sample: integer
  const formattedSample = (currentSampleIndex != null && Number.isFinite(currentSampleIndex))
    ? Math.round(currentSampleIndex)
    : '--';

  // Beat: (beatIndex + 1) or '--' if null, / totalBeats
  const currentBeatText = (beatIndex != null && Number.isFinite(beatIndex))
    ? beatIndex + 1
    : '--';
  const totalBeatText = (totalBeats != null && Number.isFinite(totalBeats))
    ? totalBeats
    : (totalBeats ?? '--');
  const formattedBeat = `${currentBeatText}/${totalBeatText}`;

  // HR: rounded integer or '--' if null, suffix 'BPM'
  const formattedHR = (heartRate != null && Number.isFinite(heartRate))
    ? `${Math.round(heartRate)} BPM`
    : '--';

  // Phase: convert snake_case to Title Case, show progress as a small inline bar + percentage
  const formattedPhaseName = formatPhase(phase);
  const progressPercent = Math.min(100, Math.max(0, Math.round((phaseProgress || 0) * 100)));

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '1rem',
        fontSize: '0.8rem',
        color: '#94a3b8',
        userSelect: 'none',
      }}
    >
      {/* Time display */}
      <div>
        <span style={{ color: '#f8fafc', fontVariantNumeric: 'tabular-nums' }}>
          {formattedTime}
        </span>
      </div>

      <span style={{ color: '#334155', userSelect: 'none' }}>|</span>

      {/* Sample Index */}
      <div>
        <span>Sample: </span>
        <span style={{ color: '#f8fafc', fontVariantNumeric: 'tabular-nums' }}>
          {formattedSample}
        </span>
      </div>

      <span style={{ color: '#334155', userSelect: 'none' }}>|</span>

      {/* Beat Index / Total Beats */}
      <div>
        <span>Beat: </span>
        <span style={{ color: '#f8fafc', fontVariantNumeric: 'tabular-nums' }}>
          {formattedBeat}
        </span>
      </div>

      <span style={{ color: '#334155', userSelect: 'none' }}>|</span>

      {/* Heart Rate */}
      <div>
        <span>HR: </span>
        <span style={{ color: '#f8fafc', fontVariantNumeric: 'tabular-nums' }}>
          {formattedHR}
        </span>
      </div>

      <span style={{ color: '#334155', userSelect: 'none' }}>|</span>

      {/* Conduction Phase & Inline Progress Bar */}
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.5rem',
        }}
      >
        <span>
          Phase: <br/>
          <span style={{ color: '#60a5fa', fontWeight: 600 }}>
            {formattedPhaseName}
          </span>
        </span>

        {/* Small inline progress bar: 60px wide, 4px tall, background: #334155, fill background: #3b82f6 */}
        <div
          style={{
            width: '60px',
            height: '4px',
            background: '#334155',
            borderRadius: '2px',
            overflow: 'hidden',
            display: 'inline-block',
          }}
          title={`Phase progress: ${progressPercent}%`}
        >
          <div
            style={{
              width: `${progressPercent}%`,
              height: '100%',
              background: '#3b82f6',
              borderRadius: '2px',
              transition: 'width 0.1s linear',
            }}
          />
        </div>

        {/* Percentage */}
        <span style={{ color: '#f8fafc', fontVariantNumeric: 'tabular-nums' }}>
          {progressPercent}%
        </span>
      </div>
    </div>
  );
}

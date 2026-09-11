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
  const progressRatio = Math.min(100, Math.max(0, (phaseProgress || 0) * 100));
  const progressPercent = Math.round(progressRatio);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '0.4rem',
        fontSize: '0.78rem',
        color: '#94a3b8',
        userSelect: 'none',
        width: '100%',
      }}
    >
      {/* Row 1: Time & Sample */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
        }}
      >
        <span style={{ color: '#f8fafc', fontVariantNumeric: 'tabular-nums' }}>
          {formattedTime}
        </span>
        <span style={{ color: '#334155', userSelect: 'none' }}>|</span>
        <div>
          <span>Sample: </span>
          <span style={{ color: '#f8fafc', fontVariantNumeric: 'tabular-nums' }}>
            {formattedSample}
          </span>
        </div>
      </div>

      {/* Row 2: Beat & Heart Rate */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
        }}
      >
        <div>
          <span>Beat: </span>
          <span style={{ color: '#f8fafc', fontVariantNumeric: 'tabular-nums' }}>
            {formattedBeat}
          </span>
        </div>
        <span style={{ color: '#334155', userSelect: 'none' }}>|</span>
        <div>
          <span>HR: </span>
          <span style={{ color: '#f8fafc', fontVariantNumeric: 'tabular-nums' }}>
            {formattedHR}
          </span>
        </div>
      </div>

      {/* Conduction Phase & Progress Bar */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '0.2rem',
          width: '100%',
          marginTop: '0.15rem',
        }}
      >
        <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>Phase:</span>
        <span
          style={{
            color: '#60a5fa',
            fontWeight: 600,
            fontSize: '0.88rem',
            lineHeight: 1.2,
          }}
        >
          {formattedPhaseName}
        </span>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            width: '100%',
            marginTop: '0.15rem',
          }}
        >
          <div
            style={{
              flex: 1,
              height: '5px',
              background: '#334155',
              borderRadius: '3px',
              overflow: 'hidden',
            }}
            title={`Phase progress: ${progressPercent}%`}
          >
            <div
              style={{
                width: `${progressRatio}%`,
                height: '100%',
                background: '#3b82f6',
                borderRadius: '3px',
                transition: 'none',
              }}
            />
          </div>
          <span
            style={{
              color: '#f8fafc',
              fontVariantNumeric: 'tabular-nums',
              fontSize: '0.78rem',
              fontWeight: 500,
              minWidth: '32px',
              textAlign: 'right',
            }}
          >
            {progressPercent}%
          </span>
        </div>
      </div>
    </div>
  );
}

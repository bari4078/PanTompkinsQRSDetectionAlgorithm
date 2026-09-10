import React from 'react';
import './heart.css';
import HeartAnatomy from './HeartAnatomy';
import ConductionSystem from './ConductionSystem';
import CardiacNodes from './CardiacNodes';

function formatPhaseName(phase) {
  if (!phase) return '';
  return phase
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export default function HeartVisualizer({ phase, progress }) {
  return (
    <div className="heart-visualizer">
      <svg className="heart-svg" viewBox="0 0 400 500" xmlns="http://www.w3.org/2000/svg">
        <HeartAnatomy phase={phase} progress={progress} />
        <ConductionSystem phase={phase} progress={progress} />
        <CardiacNodes phase={phase} progress={progress} />
      </svg>
      <div className="phase-label">
        {formatPhaseName(phase)}
        {phase !== 'diastole' && (
          <span className="phase-progress-bar">
            <span style={{ width: `${progress * 100}%` }} />
          </span>
        )}
      </div>
      <div className="disclaimer-text">
        Educational model — conduction timing approximated from detected R-peaks
      </div>
    </div>
  );
}

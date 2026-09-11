import React, { useMemo } from 'react';
import Plot from 'react-plotly.js';

/**
 * Memoized ECGPlot component to prevent unnecessary Plotly re-renders during playback.
 * The Plotly canvas only updates when the underlying data, active stage, selected beat,
 * diagnostic toggles, or zoom range change.
 *
 * Playback cursor movement is handled by the isolated PlaybackCursor component,
 * which tracks Plotly's actual rendered coordinates without triggering Plotly diffs.
 */
function ECGPlotComponent({
  data,
  activeStage = 'original',
  selectedBeatIndex = 0,
  showRefractory = true,
  showSearchback = true,
  showRejectedT = true,
  showThresholds = true,
  showDelineation = true,
  windowSize = 150,
  fs = 360,
  xRange = [0, 10],
  selectedRecord = '100',
  stageConfig = {},
  onPlotClick,
  onRelayout,
}) {

  const { plotData, shapes, annotations } = useMemo(() => {
    if (!data?.stages) {
      return { plotData: [], shapes: [], annotations: [] };
    }

    const signalData = data.stages[activeStage];
    if (!signalData || !Array.isArray(signalData)) {
      return { plotData: [], shapes: [], annotations: [] };
    }

    const timeAxis = Array.from({ length: signalData.length }, (_, i) => i / fs);
    const stageColor = stageConfig[activeStage]?.color || '#3b82f6';

    const pData = [
      {
        x: timeAxis,
        y: signalData,
        type: 'scatter',
        mode: 'lines',
        name: `${activeStage.charAt(0).toUpperCase() + activeStage.slice(1)} Signal`,
        line: { color: stageColor, width: 2 },
        hoverinfo: 'x+y',
      },
    ];

    const sShapes = [];
    const sAnnotations = [];

    const delineatedBeats = data.delineation || [];
    const currentBeat = delineatedBeats[selectedBeatIndex] || delineatedBeats[0];

    // 1. Refractory Intervals (200 ms physiological blanking)
    if (showRefractory) {
      const intervals =
        data.stages.refractory_intervals && data.stages.refractory_intervals.length > 0
          ? data.stages.refractory_intervals
          : (data.stages.peaks_original || []).map((p) => [
            p,
            Math.min(signalData.length, p + Math.round(0.2 * fs)),
          ]);

      intervals.forEach(([startSample, endSample]) => {
        sShapes.push({
          type: 'rect',
          xref: 'x',
          yref: 'paper',
          x0: startSample / fs,
          x1: endSample / fs,
          y0: 0,
          y1: 1,
          fillcolor: 'rgba(239, 68, 68, 0.08)',
          line: { color: 'rgba(239, 68, 68, 0.22)', width: 1, dash: 'dot' },
          layer: 'below',
        });
      });

      pData.push({
        x: [null],
        y: [null],
        type: 'scatter',
        mode: 'markers',
        name: '200 ms Refractory Blanking',
        marker: {
          symbol: 'square',
          color: 'rgba(239, 68, 68, 0.45)',
          size: 9,
          line: { color: '#ef4444', width: 1 },
        },
      });
    }

    // 2. Search-Back Detections (Amber diamond + label)
    if (showSearchback && data.stages.searchback && data.stages.searchback.length > 0) {
      const validSb = data.stages.searchback.filter((p) => p < signalData.length);
      if (validSb.length > 0) {
        pData.push({
          x: validSb.map((p) => p / fs),
          y: validSb.map((p) => signalData[p]),
          type: 'scatter',
          mode: 'markers+text',
          name: 'Search-back Detections',
          text: validSb.map(() => '<b>Search-back</b>'),
          textposition: 'top center',
          textfont: { color: '#f59e0b', size: 11, family: 'Inter, sans-serif' },
          marker: {
            color: '#f59e0b',
            size: 11,
            symbol: 'diamond',
            line: { color: '#ffffff', width: 2 },
          },
          hoverinfo: 'text+x+y',
          hovertext: validSb.map((p) => `Search-back QRS: ${(p / fs).toFixed(3)} s (Sample ${p})`),
        });
      }
    }

    // 3. T-Wave Rejection Markers
    if (showRejectedT && data.stages.rejected_t_waves && data.stages.rejected_t_waves.length > 0) {
      const validRejected = data.stages.rejected_t_waves.filter((p) => p < signalData.length);
      if (validRejected.length > 0) {
        pData.push({
          x: validRejected.map((p) => p / fs),
          y: validRejected.map((p) => signalData[p]),
          type: 'scatter',
          mode: 'markers',
          name: 'Rejected: T-wave',
          marker: {
            color: '#c084fc',
            size: 8,
            symbol: 'circle-open',
            line: { color: '#c084fc', width: 2 },
          },
          hoverinfo: 'text+x+y',
          hovertext: validRejected.map(() => 'Rejected: T-wave'),
        });
      }
    }

    // 4. Stage-specific Overlays
    if (activeStage === 'original') {
      const searchbackSet = new Set(data.stages.searchback || []);

      // QRS Morphological Delineation Overlays for selected beat
      if (
        showDelineation &&
        currentBeat &&
        typeof currentBeat.qrs_onset_time === 'number' &&
        typeof currentBeat.qrs_offset_time === 'number'
      ) {
        // Subtle shaded QRS complex
        sShapes.push({
          type: 'rect',
          xref: 'x',
          yref: 'paper',
          x0: currentBeat.qrs_onset_time,
          x1: currentBeat.qrs_offset_time,
          y0: 0,
          y1: 1,
          fillcolor: 'rgba(59, 130, 246, 0.16)',
          line: { color: 'rgba(59, 130, 246, 0.45)', width: 1.5, dash: 'dot' },
          layer: 'below',
        });

        // Vertical boundary line for QRS Onset
        sShapes.push({
          type: 'line',
          xref: 'x',
          yref: 'paper',
          x0: currentBeat.qrs_onset_time,
          x1: currentBeat.qrs_onset_time,
          y0: 0,
          y1: 0.95,
          line: { color: '#10b981', width: 1.5, dash: 'dash' },
        });

        // Vertical boundary line for QRS Offset
        sShapes.push({
          type: 'line',
          xref: 'x',
          yref: 'paper',
          x0: currentBeat.qrs_offset_time,
          x1: currentBeat.qrs_offset_time,
          y0: 0,
          y1: 0.95,
          line: { color: '#06b6d4', width: 1.5, dash: 'dash' },
        });

        // Q Point marker
        if (currentBeat.q_index != null && typeof currentBeat.q_time === 'number') {
          pData.push({
            x: [currentBeat.q_time],
            y: [signalData[currentBeat.q_index]],
            type: 'scatter',
            mode: 'markers+text',
            name: 'Q Point',
            text: ['<b>Q</b>'],
            textposition: 'bottom left',
            textfont: { color: '#f59e0b', size: 11, family: 'Inter, sans-serif' },
            marker: {
              color: '#f59e0b',
              size: 9,
              symbol: 'circle',
              line: { color: '#ffffff', width: 1.5 },
            },
          });
        }

        // R Peak marker (or QS nadir if inverted)
        if (currentBeat.r_index != null && typeof currentBeat.r_time === 'number') {
          pData.push({
            x: [currentBeat.r_time],
            y: [signalData[currentBeat.r_index]],
            type: 'scatter',
            mode: 'markers+text',
            name: 'R Peak',
            text: ['<b>R</b>'],
            textposition: 'top center',
            textfont: { color: '#ef4444', size: 12, family: 'Inter, sans-serif' },
            marker: {
              color: '#ef4444',
              size: 11,
              symbol: 'circle',
              line: { color: '#ffffff', width: 2 },
            },
          });
        } else if (currentBeat.dominant_deflection_index != null) {
          pData.push({
            x: [currentBeat.dominant_deflection_index / fs],
            y: [signalData[currentBeat.dominant_deflection_index]],
            type: 'scatter',
            mode: 'markers+text',
            name: 'QS Nadir',
            text: ['<b>QS</b>'],
            textposition: 'bottom center',
            textfont: { color: '#ec4899', size: 11, family: 'Inter, sans-serif' },
            marker: {
              color: '#ec4899',
              size: 11,
              symbol: 'diamond',
              line: { color: '#ffffff', width: 2 },
            },
          });
        }

        // S Point marker
        if (currentBeat.s_index != null && typeof currentBeat.s_time === 'number') {
          pData.push({
            x: [currentBeat.s_time],
            y: [signalData[currentBeat.s_index]],
            type: 'scatter',
            mode: 'markers+text',
            name: 'S Point',
            text: ['<b>S</b>'],
            textposition: 'bottom right',
            textfont: { color: '#38bdf8', size: 11, family: 'Inter, sans-serif' },
            marker: {
              color: '#38bdf8',
              size: 9,
              symbol: 'circle',
              line: { color: '#ffffff', width: 1.5 },
            },
          });
        }

        // Onset marker
        if (currentBeat.qrs_onset_index != null) {
          pData.push({
            x: [currentBeat.qrs_onset_time],
            y: [signalData[currentBeat.qrs_onset_index]],
            type: 'scatter',
            mode: 'markers',
            name: 'QRS Onset Marker',
            marker: { color: '#10b981', size: 7, symbol: 'circle' },
            showlegend: false,
          });
        }

        // Offset marker
        if (currentBeat.qrs_offset_index != null) {
          pData.push({
            x: [currentBeat.qrs_offset_time],
            y: [signalData[currentBeat.qrs_offset_index]],
            type: 'scatter',
            mode: 'markers',
            name: 'QRS Offset Marker',
            marker: { color: '#06b6d4', size: 7, symbol: 'circle' },
            showlegend: false,
          });
        }
      }

      // Other primary peaks across the sweep
      if (data.stages.peaks_original) {
        const otherNormal = data.stages.peaks_original.filter(
          (p) =>
            !searchbackSet.has(p) &&
            (showDelineation && currentBeat
              ? p !== currentBeat.pt_qrs_index && p !== currentBeat.r_index
              : true)
        );

        if (otherNormal.length > 0) {
          pData.push({
            x: otherNormal.map((p) => p / fs),
            y: otherNormal.map((p) => signalData[p]),
            type: 'scatter',
            mode: 'markers',
            name: 'Primary QRS Peaks',
            marker: {
              color: 'rgba(239, 68, 68, 0.45)',
              size: 8,
              symbol: 'circle-open',
              line: { width: 1.5, color: '#ef4444' },
            },
          });
        }
      }
    } else if (activeStage === 'integrated') {
      // Visual representation of moving-window width
      const winSec = windowSize / 1000;
      const winSamples = Math.round(winSec * fs);
      const winStart = 0.35;
      const winEnd = winStart + winSec;

      sShapes.push({
        type: 'rect',
        xref: 'x',
        yref: 'paper',
        x0: winStart,
        x1: winEnd,
        y0: 0.82,
        y1: 0.96,
        fillcolor: 'rgba(16, 185, 129, 0.22)',
        line: { color: '#10b981', width: 1.5, dash: 'solid' },
      });

      sAnnotations.push({
        x: (winStart + winEnd) / 2,
        y: 0.89,
        yref: 'paper',
        text: `<b>← Moving Window: ${windowSize} ms (${winSamples} samples) →</b>`,
        showarrow: false,
        font: { color: '#10b981', size: 10, family: 'Inter, sans-serif' },
        bgcolor: 'rgba(15, 23, 42, 0.85)',
        bordercolor: '#10b981',
        borderwidth: 1,
        borderpad: 3,
      });

      // Adaptive thresholds
      if (showThresholds) {
        if (data.stages.threshold_i1) {
          pData.push({
            x: timeAxis,
            y: data.stages.threshold_i1,
            type: 'scatter',
            mode: 'lines',
            name: 'Threshold I1 (Primary)',
            line: { color: '#f59e0b', width: 2 },
          });
        }
        if (data.stages.threshold_i2) {
          pData.push({
            x: timeAxis,
            y: data.stages.threshold_i2,
            type: 'scatter',
            mode: 'lines',
            name: 'Threshold I2 (Search-back)',
            line: { color: '#fbbf24', width: 1.5, dash: 'dash' },
          });
        }
      }

      if (data.stages.peaks_integrated && data.stages.peaks_integrated.length > 0) {
        pData.push({
          x: data.stages.peaks_integrated.map((p) => p / fs),
          y: data.stages.peaks_integrated.map((p) => signalData[p]),
          type: 'scatter',
          mode: 'markers',
          name: 'Integrated Energy Peaks',
          marker: { color: '#10b981', size: 8, symbol: 'circle' },
        });
      }
    } else if (activeStage === 'bandpass') {
      if (showThresholds) {
        if (data.stages.threshold_f1) {
          pData.push({
            x: timeAxis,
            y: data.stages.threshold_f1,
            type: 'scatter',
            mode: 'lines',
            name: 'Threshold F1 (Primary)',
            line: { color: '#f59e0b', width: 2 },
          });
        }
        if (data.stages.threshold_f2) {
          pData.push({
            x: timeAxis,
            y: data.stages.threshold_f2,
            type: 'scatter',
            mode: 'lines',
            name: 'Threshold F2 (Search-back)',
            line: { color: '#fbbf24', width: 1.5, dash: 'dash' },
          });
        }
      }
    }

    return { plotData: pData, shapes: sShapes, annotations: sAnnotations };
  }, [
    data,
    activeStage,
    selectedBeatIndex,
    showRefractory,
    showSearchback,
    showRejectedT,
    showThresholds,
    showDelineation,
    windowSize,
    fs,
    stageConfig,
  ]);

  return (
    <Plot
      data={plotData}
      layout={{
        autosize: true,
        uirevision: selectedRecord,
        margin: { l: 58, r: 18, t: 18, b: 52 },
        paper_bgcolor: 'transparent',
        plot_bgcolor: 'transparent',
        font: { color: '#94a3b8' },
        xaxis: {
          title: { text: 'Time (seconds)', standoff: 10 },
          gridcolor: '#334155',
          zerolinecolor: '#334155',
          range: xRange,
          fixedrange: false,
        },
        yaxis: {
          title: { text: 'Amplitude (mV / arbitrary units)', standoff: 8 },
          gridcolor: '#334155',
          zerolinecolor: '#334155',
          fixedrange: false,
        },
        shapes,
        annotations,
        showlegend: true,
        legend: {
          orientation: 'h',
          x: 0,
          y: 1.14,
          font: { color: '#94a3b8', size: 10 },
          bgcolor: 'rgba(15,23,42,0.6)',
        },
      }}
      useResizeHandler={true}
      style={{ width: '100%', height: '100%' }}
      config={{
        responsive: true,
        displayModeBar: true,
        modeBarButtonsToRemove: ['lasso2d', 'select2d'],
        displaylogo: false,
      }}
      onClick={onPlotClick}
      onRelayout={onRelayout}
    />
  );
}

// React.memo with custom equality check:
// ECGPlot only re-renders when signal data, active stage, selected beat,
// toggles, or zoom range change. Changes in playback position do NOT re-render Plotly!
const ECGPlot = React.memo(ECGPlotComponent, (prevProps, nextProps) => {
  return (
    prevProps.data === nextProps.data &&
    prevProps.activeStage === nextProps.activeStage &&
    prevProps.selectedBeatIndex === nextProps.selectedBeatIndex &&
    prevProps.showRefractory === nextProps.showRefractory &&
    prevProps.showSearchback === nextProps.showSearchback &&
    prevProps.showRejectedT === nextProps.showRejectedT &&
    prevProps.showThresholds === nextProps.showThresholds &&
    prevProps.showDelineation === nextProps.showDelineation &&
    prevProps.windowSize === nextProps.windowSize &&
    prevProps.fs === nextProps.fs &&
    prevProps.selectedRecord === nextProps.selectedRecord &&
    prevProps.xRange[0] === nextProps.xRange[0] &&
    prevProps.xRange[1] === nextProps.xRange[1]
  );
});

export default ECGPlot;

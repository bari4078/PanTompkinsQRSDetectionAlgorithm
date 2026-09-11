import React, { useState, useEffect, Suspense } from 'react';
import Plot from 'react-plotly.js';
import {
  Activity,
  Heart,
  ActivitySquare,
  AlertTriangle,
  CheckCircle2,
  BookOpen,
  Settings,
  Maximize2,
  Cpu,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  ZoomIn,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { usePlaybackEngine } from './playback/usePlaybackEngine';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import HeartModel from './HeartModel';
import PlaybackControls from './components/Playback/PlaybackControls';
import PlaybackStats from './components/Playback/PlaybackStats';
import './index.css';

const DURATION = 10; // seconds

function App() {
  const [records, setRecords] = useState([]);
  const [selectedRecord, setSelectedRecord] = useState('100');
  const [windowSize, setWindowSize] = useState(150);
  const [lowcut, setLowcut] = useState(5.0);
  const [highcut, setHighcut] = useState(15.0);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [activeStage, setActiveStage] = useState('original');
  const [selectedBeatIndex, setSelectedBeatIndex] = useState(0);
  const [xRange, setXRange] = useState([0, DURATION]);
  const [isEvidenceOpen, setIsEvidenceOpen] = useState(false);

  // Extract R-peaks and fs for the playback engine
  const rPeaks = data?.stages?.peaks_original || [];
  const fs = data?.fs || 360;

  // Centralized playback engine — single source of truth for timing + cardiac phase
  const [playbackState, playbackControls] = usePlaybackEngine({
    fs,
    rPeaks,
    duration: DURATION,
  });

  // Fetch available records on mount
  useEffect(() => {
    fetch('http://localhost:8000/api/records')
      .then(res => res.json())
      .then(result => {
        if (result.records && result.records.length > 0) {
          setRecords(result.records);
          setSelectedRecord(result.records[0]);
        }
      })
      .catch(err => console.error('Failed to fetch records:', err));
  }, []);

  const processSignal = async () => {
    setLoading(true);
    setError(null);
    playbackControls.stop();
    setSelectedBeatIndex(0);
    setXRange([0, DURATION]);

    try {
      const response = await fetch('http://localhost:8000/api/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          record_id: selectedRecord,
          window_size_ms: windowSize,
          lowcut,
          highcut,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to process signal');
      }

      const result = await response.json();
      setData(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (records.length > 0) {
      processSignal();
    }
  }, [records, selectedRecord]);

  const focusBeat = (idx) => {
    const beats = data?.delineation || [];
    const b = beats[idx];
    if (!b) return;
    const center = b.r_time !== null ? b.r_time : (b.dominant_deflection_index / fs);
    const halfWin = 0.35; // 350ms window
    setXRange([Math.max(0, center - halfWin), Math.min(DURATION, center + halfWin)]);
  };

  const resetZoom = () => {
    setXRange([0, DURATION]);
  };

  const handlePrevBeat = () => {
    if (!data?.delineation?.length) return;
    const prevIdx = Math.max(0, selectedBeatIndex - 1);
    setSelectedBeatIndex(prevIdx);
    focusBeat(prevIdx);
  };

  const handleNextBeat = () => {
    if (!data?.delineation?.length) return;
    const nextIdx = Math.min(data.delineation.length - 1, selectedBeatIndex + 1);
    setSelectedBeatIndex(nextIdx);
    focusBeat(nextIdx);
  };

  const handlePlotClick = (evt) => {
    if (!evt.points || evt.points.length === 0 || !data?.delineation?.length) return;
    const clickX = evt.points[0].x;
    let closestIdx = 0;
    let minDiff = Infinity;
    data.delineation.forEach((b, idx) => {
      const refTime = b.r_time !== null ? b.r_time : (b.dominant_deflection_index / fs);
      const diff = Math.abs(refTime - clickX);
      if (diff < minDiff) {
        minDiff = diff;
        closestIdx = idx;
      }
    });
    if (minDiff < 0.6) {
      setSelectedBeatIndex(closestIdx);
    }
  };

  const handleRelayout = (event) => {
    if (event['xaxis.range[0]'] !== undefined && event['xaxis.range[1]'] !== undefined) {
      setXRange([event['xaxis.range[0]'], event['xaxis.range[1]']]);
    } else if (event['xaxis.autorange']) {
      setXRange([0, DURATION]);
    }
  };

  const renderPlot = () => {
    if (!data) return null;

    const signalData = data.stages[activeStage];
    const timeAxis = Array.from(
      { length: signalData.length },
      (_, i) => i / fs
    );

    const plotData = [
      {
        x: timeAxis,
        y: signalData,
        type: 'scatter',
        mode: 'lines',
        name: `${activeStage.charAt(0).toUpperCase() + activeStage.slice(1)} Signal`,
        line: { color: '#3b82f6', width: 2 },
        hoverinfo: 'x+y',
      },
    ];

    const shapes = [];
    const annotations = [];

    const delineatedBeats = data.delineation || [];
    const currentBeat = delineatedBeats[selectedBeatIndex] || delineatedBeats[0];

    if (activeStage === 'original') {
      const searchbackSet = new Set(data.stages.searchback || []);

      // 1. Shaded QRS region and boundary lines for the selected beat
      if (currentBeat) {
        // Subtle shaded QRS region from onset to offset
        shapes.push({
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
        shapes.push({
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
        shapes.push({
          type: 'line',
          xref: 'x',
          yref: 'paper',
          x0: currentBeat.qrs_offset_time,
          x1: currentBeat.qrs_offset_time,
          y0: 0,
          y1: 0.95,
          line: { color: '#06b6d4', width: 1.5, dash: 'dash' },
        });

        // Horizontal local isoelectric baseline
        shapes.push({
          type: 'line',
          xref: 'x',
          yref: 'y',
          x0: Math.max(0, currentBeat.qrs_onset_time - 0.08),
          x1: Math.min(DURATION, currentBeat.qrs_offset_time + 0.08),
          y0: currentBeat.isoelectric_baseline,
          y1: currentBeat.isoelectric_baseline,
          line: { color: 'rgba(148, 163, 184, 0.35)', width: 1, dash: 'dot' },
          layer: 'below',
        });

        // Small non-overlapping annotation for Onset
        annotations.push({
          x: currentBeat.qrs_onset_time,
          y: 0.04,
          yref: 'paper',
          text: '<b>Onset ↑</b>',
          showarrow: false,
          font: { color: '#10b981', size: 10, family: 'Inter, sans-serif' },
          bgcolor: 'rgba(15, 23, 42, 0.85)',
          bordercolor: '#10b981',
          borderwidth: 1,
          borderpad: 2,
        });

        // Small non-overlapping annotation for Offset
        annotations.push({
          x: currentBeat.qrs_offset_time,
          y: 0.04,
          yref: 'paper',
          text: '<b>Offset ↑</b>',
          showarrow: false,
          font: { color: '#06b6d4', size: 10, family: 'Inter, sans-serif' },
          bgcolor: 'rgba(15, 23, 42, 0.85)',
          bordercolor: '#06b6d4',
          borderwidth: 1,
          borderpad: 2,
        });

        // Q Point marker
        if (currentBeat.q_index !== null) {
          plotData.push({
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
        if (currentBeat.r_index !== null) {
          plotData.push({
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
        } else if (currentBeat.dominant_deflection_index !== null) {
          plotData.push({
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
        if (currentBeat.s_index !== null) {
          plotData.push({
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
        plotData.push({
          x: [currentBeat.qrs_onset_time],
          y: [signalData[currentBeat.qrs_onset_index]],
          type: 'scatter',
          mode: 'markers',
          name: 'QRS Onset Marker',
          marker: {
            color: '#10b981',
            size: 7,
            symbol: 'circle',
          },
          showlegend: false,
        });

        // Offset marker
        plotData.push({
          x: [currentBeat.qrs_offset_time],
          y: [signalData[currentBeat.qrs_offset_index]],
          type: 'scatter',
          mode: 'markers',
          name: 'QRS Offset Marker',
          marker: {
            color: '#06b6d4',
            size: 7,
            symbol: 'circle',
          },
          showlegend: false,
        });
      }

      // 2. Subtle markers for all other beats across the 10-second sweep
      if (data.stages.peaks_original) {
        const otherNormal = data.stages.peaks_original.filter(
          (p) => !searchbackSet.has(p) && (currentBeat ? p !== currentBeat.pt_qrs_index && p !== currentBeat.r_index : true)
        );
        const otherSb = data.stages.peaks_original.filter(
          (p) => searchbackSet.has(p) && (currentBeat ? p !== currentBeat.pt_qrs_index && p !== currentBeat.r_index : true)
        );

        if (otherNormal.length > 0) {
          plotData.push({
            x: otherNormal.map((p) => p / fs),
            y: otherNormal.map((p) => signalData[p]),
            type: 'scatter',
            mode: 'markers',
            name: 'Other QRS (Normal)',
            marker: {
              color: 'rgba(239, 68, 68, 0.45)',
              size: 8,
              symbol: 'circle-open',
              line: { width: 1.5 },
            },
          });
        }

        if (otherSb.length > 0) {
          plotData.push({
            x: otherSb.map((p) => p / fs),
            y: otherSb.map((p) => signalData[p]),
            type: 'scatter',
            mode: 'markers',
            name: 'Other Search-Back',
            marker: {
              color: 'rgba(245, 158, 11, 0.6)',
              size: 9,
              symbol: 'diamond-open',
              line: { width: 1.5 },
            },
          });
        }
      }
    } else if (activeStage === 'integrated') {
      if (data.stages.threshold_i1) {
        plotData.push({
          x: timeAxis,
          y: data.stages.threshold_i1,
          type: 'scatter',
          mode: 'lines',
          name: 'Threshold I1 (Primary)',
          line: { color: '#f59e0b', width: 2 },
        });
      }
      if (data.stages.threshold_i2) {
        plotData.push({
          x: timeAxis,
          y: data.stages.threshold_i2,
          type: 'scatter',
          mode: 'lines',
          name: 'Threshold I2 (Search-back)',
          line: { color: '#fbbf24', width: 1.5, dash: 'dash' },
        });
      }
      if (data.stages.peaks_integrated && data.stages.peaks_integrated.length > 0) {
        plotData.push({
          x: data.stages.peaks_integrated.map((p) => p / fs),
          y: data.stages.peaks_integrated.map((p) => signalData[p]),
          type: 'scatter',
          mode: 'markers',
          name: 'Integrated QRS Peaks',
          marker: {
            color: '#10b981',
            size: 8,
            symbol: 'circle',
          },
        });
      }
      if (data.stages.rejected_t_waves && data.stages.rejected_t_waves.length > 0) {
        plotData.push({
          x: data.stages.rejected_t_waves.map((p) => p / fs),
          y: data.stages.rejected_t_waves.map((p) => signalData[p]),
          type: 'scatter',
          mode: 'markers',
          name: 'Rejected T-Waves',
          marker: {
            color: '#c084fc',
            size: 9,
            symbol: 'x',
          },
        });
      }
    } else if (activeStage === 'bandpass') {
      if (data.stages.threshold_f1) {
        plotData.push({
          x: timeAxis,
          y: data.stages.threshold_f1,
          type: 'scatter',
          mode: 'lines',
          name: 'Threshold F1 (Primary)',
          line: { color: '#f59e0b', width: 2 },
        });
      }
      if (data.stages.threshold_f2) {
        plotData.push({
          x: timeAxis,
          y: data.stages.threshold_f2,
          type: 'scatter',
          mode: 'lines',
          name: 'Threshold F2 (Search-back)',
          line: { color: '#fbbf24', width: 1.5, dash: 'dash' },
        });
      }
    }

    const [xMin, xMax] = xRange;
    const currentT = playbackState.currentTime;
    const inView = currentT >= xMin && currentT <= xMax;
    const pct = inView && (xMax > xMin) ? (currentT - xMin) / (xMax - xMin) : null;

    return (
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          minHeight: 0,
        }}
      >
        <Plot
          data={plotData}
          layout={{
            autosize: true,
            margin: { l: 58, r: 18, t: 14, b: 52 },
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
              title: { text: 'Amplitude (mV)', standoff: 8 },
              gridcolor: '#334155',
              zerolinecolor: '#334155',
              fixedrange: false,
            },
            shapes: shapes,
            annotations: annotations,
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
          onClick={handlePlotClick}
          onRelayout={handleRelayout}
        />

        {/* Playback cursor */}
        {pct !== null && (
          <div
            style={{
              position: 'absolute',
              top: 14,
              bottom: 52,
              left: `calc(58px + (100% - 76px) * ${pct})`,
              width: 2,
              backgroundColor: '#ef4444',
              zIndex: 10,
              boxShadow: '0 0 10px rgba(239,68,68,0.8)',
              pointerEvents: 'none',
              transition: 'none',
            }}
          />
        )}
      </div>
    );
  };

  const cardStyle = {
    background: 'var(--card-bg, #1b263b)',
    border: '1px solid var(--border-color, #334155)',
    borderRadius: '18px',
    minWidth: 0,
    boxSizing: 'border-box',
  };

  return (
    <div className="app-container" style={{ minHeight: '100vh' }}>
      {/* ───────────────────────── Header ───────────────────────── */}
      <header
        className="header"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1.5rem',
          marginBottom: '1.1rem',
        }}
      >
        <div>
          <h1 style={{ marginBottom: '0.2rem' }}>Pan-Tompkins Algorithm</h1>
          <p style={{ margin: 0 }}>
            Advanced QRS Detection &amp; Cardiac Conduction Visualization
          </p>
        </div>

        <div
          style={{
            display: 'flex',
            gap: '0.65rem',
            flexShrink: 0,
          }}
        >
          <button
            type="button"
            className="stage-btn"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.45rem',
              padding: '0.65rem 0.9rem',
            }}
          >
            <BookOpen size={17} />
            Documentation
          </button>
          {/* <button
            type="button"
            className="stage-btn"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.45rem',
              padding: '0.65rem 0.9rem',
            }}
          >
            <Settings size={17} />
            Settings
          </button> */}
        </div>
      </header>

      {/* Desktop structure:
          1) fixed-ish sidebar
          2) flexible analytics column
          3) large heart column
          The heart occupies the whole right side so it can stay visually dominant.
      */}
      <div
        className="dashboard-grid"
        style={{
          display: 'grid',
          gridTemplateColumns:
            'minmax(200px, 220px) minmax(520px, 1fr) minmax(380px, 430px)',
          gap: '1.15rem',
          alignItems: 'stretch',
        }}
      >
        {/* ───────────────────────── Left controls ───────────────────────── */}
        <aside
          className="card"
          style={{
            ...cardStyle,
            padding: '0.85rem 0.8rem',
            alignSelf: 'stretch',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.45rem',
          }}
        >
          <div>
            <h2
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                margin: 0,
                fontSize: '1rem',
              }}
            >
              <Activity size={18} />
              Parameters
            </h2>
          </div>

          <div className="form-group">
            <label>MIT-BIH Record</label>
            <select
              className="form-control"
              value={selectedRecord}
              onChange={(e) => setSelectedRecord(e.target.value)}
            >
              {records.map((rec) => (
                <option key={rec} value={rec}>
                  Record {rec}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>
              Bandpass Lowcut <span>{lowcut.toFixed(1)} Hz</span>
            </label>
            <input
              type="range"
              className="range-slider"
              min="1"
              max="10"
              step="0.5"
              value={lowcut}
              onChange={(e) => setLowcut(Number(e.target.value))}
            />
          </div>

          <div className="form-group">
            <label>
              Bandpass Highcut <span>{highcut.toFixed(1)} Hz</span>
            </label>
            <input
              type="range"
              className="range-slider"
              min="10"
              max="30"
              step="0.5"
              value={highcut}
              onChange={(e) => setHighcut(Number(e.target.value))}
            />
          </div>

          <button
            className="btn"
            onClick={processSignal}
            disabled={loading}
            style={{ width: '100%' }}
          >
            {loading ? 'Processing...' : 'Apply & Process'}
          </button>

          {error && (
            <div
              style={{
                color: '#ef4444',
                marginTop: '0.1rem',
                fontSize: '0.82rem',
                lineHeight: 1.4,
              }}
            >
              Error: {error}
            </div>
          )}

          <div
            style={{
              height: 1,
              background: 'rgba(148,163,184,0.18)',
              margin: '0.2rem 0 0.1rem',
            }}
          />

          {/* Playback moved into the sidebar to free the main area for the ECG */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              marginBottom: '-0.25rem',
            }}
          >
            <ActivitySquare size={17} />
            <h3
              style={{
                margin: 0,
                fontSize: '0.92rem',
                color: 'var(--text-primary, #f8fafc)',
              }}
            >
              Playback Controls
            </h3>
          </div>

          <div style={{ minWidth: 0 }}>
            <PlaybackControls
              state={playbackState}
              controls={playbackControls}
              duration={DURATION}
            />
          </div>

          <div
            style={{
              marginTop: 'auto',
              paddingTop: '0.1rem',
              borderTop: '1px solid rgba(148,163,184,0.12)',
            }}
          >
            <PlaybackStats
              state={playbackState}
              duration={DURATION}
              totalBeats={rPeaks.length}
            />
          </div>
        </aside>

        {/* ───────────────────────── Center analytics ───────────────────────── */}
        <main
          style={{
            minWidth: 0,
            display: 'grid',
            gridTemplateRows: 'auto minmax(0, 1fr)',
            gap: '1.15rem',
          }}
        >
          {/* 4 compact metric cards in ONE row */}
          <div
            className="metrics-grid"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
              gap: '0.85rem',
              margin: 0,
            }}
          >
            <div
              className="metric-card"
              style={{
                ...cardStyle,
                minHeight: 100,
                padding: '1.05rem 1.15rem',
                textAlign: 'left',
              }}
            >
              <div className="metric-label">HEART RATE</div>
              <div
                className="metric-value"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-start',
                  gap: '0.6rem',
                }}
              >
                <Heart size={25} color="#ef4444" />
                {data ? `${data.analysis.hr_bpm} BPM` : '--'}
              </div>
            </div>

            <div
              className="metric-card"
              style={{
                ...cardStyle,
                minHeight: 100,
                padding: '1.05rem 1.15rem',
                textAlign: 'left',
              }}
            >
              <div className="metric-label">HRV (SDNN)</div>
              <div
                className="metric-value"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-start',
                  gap: '0.55rem',
                }}
              >
                <Activity size={25} color="#60a5fa" />
                {data ? `${data.analysis.sdnn_ms} ms` : '--'}
              </div>
            </div>

            <div
              className="metric-card"
              style={{
                ...cardStyle,
                minHeight: 100,
                padding: '1.05rem 1rem',
                textAlign: 'left',
              }}
            >
              <div className="metric-label">RHYTHM STATUS</div>
              <div className="abnormalities" style={{ marginTop: '0.55rem' }}>
                {data ? (
                  data.analysis.abnormalities.map((abn, i) => (
                    <div
                      key={i}
                      className={`alert ${abn.includes('Normal') ? 'success' : 'danger'
                        }`}
                      style={{
                        margin: 0,
                        fontSize: '0.82rem',
                        justifyContent: 'flex-start',
                      }}
                    >
                      {abn.includes('Normal') ? (
                        <CheckCircle2 size={16} />
                      ) : (
                        <AlertTriangle size={16} />
                      )}
                      {abn}
                    </div>
                  ))
                ) : (
                  <div style={{ color: 'var(--text-muted)' }}>
                    Waiting for data...
                  </div>
                )}
              </div>
            </div>

            <div
              className="metric-card"
              style={{
                ...cardStyle,
                minHeight: 100,
                padding: '1.05rem 1rem',
                textAlign: 'left',
              }}
            >
              <div
                className="metric-label"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                }}
              >
                <Cpu size={14} color="#f59e0b" />
                PAN-TOMPKINS STATS
              </div>
              <div
                style={{
                  marginTop: '0.45rem',
                  fontSize: '0.78rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.22rem',
                  color: 'var(--text-secondary, #cbd5e1)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>QRS Beats:</span>
                  <strong style={{ color: '#10b981' }}>
                    {data?.stages?.detected_peaks?.length || '--'}
                  </strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Search-back Beats:</span>
                  <strong style={{ color: '#f59e0b' }}>
                    {data?.stages?.searchback?.length || 0}
                  </strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Rejected T-Waves:</span>
                  <strong style={{ color: '#c084fc' }}>
                    {data?.stages?.rejected_t_waves?.length || 0}
                  </strong>
                </div>
              </div>
            </div>
          </div>

          {/* ECG stage viewer gets center-column workspace */}
          <section
            className="card"
            style={{
              ...cardStyle,
              minHeight: 0,
              padding: '0.9rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.7rem',
              overflowY: 'auto',
            }}
          >
            {/* Header: Title + Algorithm Stage Tabs */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '1rem',
                marginBottom: '0.2rem',
                padding: '0 0.25rem',
                flexWrap: 'wrap',
              }}
            >
              <h2
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.55rem',
                  margin: 0,
                  fontSize: '1.15rem',
                }}
              >
                <ActivitySquare size={22} />
                Algorithm Stages
              </h2>

              <div
                className="stage-selector"
                style={{
                  marginBottom: 0,
                  display: 'flex',
                  gap: '0.25rem',
                  flexWrap: 'wrap',
                  justifyContent: 'flex-end',
                }}
              >
                {[
                  'original',
                  'bandpass',
                  'derivative',
                  'squared',
                  'integrated',
                ].map((stage) => (
                  <button
                    key={stage}
                    className={`stage-btn ${activeStage === stage ? 'active' : ''
                      }`}
                    onClick={() => setActiveStage(stage)}
                  >
                    {stage.charAt(0).toUpperCase() + stage.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* ECG Plot Container */}
            <div
              className="plot-container"
              style={{
                position: 'relative',
                minHeight: 340,
                height: 380,
                flexShrink: 0,
                overflow: 'hidden',
              }}
            >
              {loading && (
                <div className="loading-overlay">
                  <Activity size={32} />
                  <span>Processing Signal...</span>
                </div>
              )}
              {renderPlot()}
            </div>

            {/* Selected-Beat Information Panel & Pan-Tompkins Evidence */}
            {data?.delineation?.length > 0 && (() => {
              const selectedBeat = data.delineation[selectedBeatIndex] || data.delineation[0];
              const totalBeats = data.delineation.length;
              const isSearchback = selectedBeat.detection_evidence?.method === 'searchback';

              return (
                <div
                  style={{
                    background: 'rgba(15, 23, 42, 0.75)',
                    border: '1px solid #334155',
                    borderRadius: '12px',
                    padding: '0.8rem 1rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.65rem',
                  }}
                >
                  {/* Beat Navigation Bar */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '0.6rem',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '1rem', fontWeight: 700, color: '#f8fafc' }}>
                        Beat #{selectedBeat.beat_index + 1}{' '}
                        <span style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: 400 }}>
                          of {totalBeats}
                        </span>
                      </span>

                      <span
                        style={{
                          fontSize: '0.72rem',
                          fontWeight: 600,
                          padding: '0.2rem 0.55rem',
                          borderRadius: '6px',
                          background: isSearchback
                            ? 'rgba(245, 158, 11, 0.18)'
                            : 'rgba(16, 185, 129, 0.18)',
                          color: isSearchback ? '#fbbf24' : '#34d399',
                          border: isSearchback
                            ? '1px solid rgba(245, 158, 11, 0.4)'
                            : '1px solid rgba(16, 185, 129, 0.4)',
                        }}
                      >
                        {isSearchback ? 'Search-Back Recovery' : 'Primary Detection'}
                      </span>

                      <span
                        style={{
                          fontSize: '0.72rem',
                          fontWeight: 600,
                          padding: '0.2rem 0.55rem',
                          borderRadius: '6px',
                          background: 'rgba(59, 130, 246, 0.18)',
                          color: '#60a5fa',
                          border: '1px solid rgba(59, 130, 246, 0.4)',
                        }}
                      >
                        {selectedBeat.dominant_deflection_type.toUpperCase()} MORPHOLOGY
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        className="stage-btn"
                        onClick={handlePrevBeat}
                        disabled={selectedBeatIndex === 0}
                        style={{
                          padding: '0.32rem 0.6rem',
                          fontSize: '0.78rem',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.2rem',
                        }}
                        title="Previous Beat"
                      >
                        <ChevronLeft size={14} /> Prev Beat
                      </button>

                      <button
                        type="button"
                        className="stage-btn"
                        onClick={handleNextBeat}
                        disabled={selectedBeatIndex === totalBeats - 1}
                        style={{
                          padding: '0.32rem 0.6rem',
                          fontSize: '0.78rem',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.2rem',
                        }}
                        title="Next Beat"
                      >
                        Next Beat <ChevronRight size={14} />
                      </button>

                      <button
                        type="button"
                        className="stage-btn"
                        onClick={() => focusBeat(selectedBeatIndex)}
                        style={{
                          padding: '0.32rem 0.6rem',
                          fontSize: '0.78rem',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.2rem',
                        }}
                        title="Zoom to inspected beat"
                      >
                        <ZoomIn size={14} /> Focus Beat
                      </button>

                      <button
                        type="button"
                        className="stage-btn"
                        onClick={resetZoom}
                        style={{
                          padding: '0.32rem 0.6rem',
                          fontSize: '0.78rem',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.2rem',
                        }}
                        title="Reset view to 0-10s"
                      >
                        <RotateCcw size={14} /> Reset Zoom
                      </button>
                    </div>
                  </div>

                  {/* Compact Selected-Beat Measurements Grid */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(6, minmax(0, 1fr))',
                      gap: '0.5rem',
                      background: 'rgba(30, 41, 59, 0.6)',
                      padding: '0.65rem 0.8rem',
                      borderRadius: '8px',
                      border: '1px solid rgba(51, 65, 85, 0.5)',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '0.68rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Q Point
                      </div>
                      <div style={{ fontSize: '0.92rem', fontWeight: 600, color: '#f59e0b', marginTop: '0.2rem' }}>
                        {selectedBeat.q_time !== null ? `${selectedBeat.q_time.toFixed(3)} s` : 'None'}
                      </div>
                    </div>

                    <div>
                      <div style={{ fontSize: '0.68rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        R Peak
                      </div>
                      <div style={{ fontSize: '0.92rem', fontWeight: 600, color: '#ef4444', marginTop: '0.2rem' }}>
                        {selectedBeat.r_time !== null ? `${selectedBeat.r_time.toFixed(3)} s` : 'None (QS)'}
                      </div>
                    </div>

                    <div>
                      <div style={{ fontSize: '0.68rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        S Point
                      </div>
                      <div style={{ fontSize: '0.92rem', fontWeight: 600, color: '#38bdf8', marginTop: '0.2rem' }}>
                        {selectedBeat.s_time !== null ? `${selectedBeat.s_time.toFixed(3)} s` : 'None'}
                      </div>
                    </div>

                    <div>
                      <div style={{ fontSize: '0.68rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        QRS Duration
                      </div>
                      <div style={{ fontSize: '0.92rem', fontWeight: 600, color: '#10b981', marginTop: '0.2rem' }}>
                        {selectedBeat.qrs_duration_ms.toFixed(1)} ms
                      </div>
                    </div>

                    <div>
                      <div style={{ fontSize: '0.68rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        RR Interval
                      </div>
                      <div style={{ fontSize: '0.92rem', fontWeight: 600, color: '#a78bfa', marginTop: '0.2rem' }}>
                        {selectedBeat.detection_evidence?.rr_interval_ms
                          ? `${selectedBeat.detection_evidence.rr_interval_ms} ms`
                          : (selectedBeat.beat_index === 0 ? 'Initial Beat' : '--')}
                      </div>
                    </div>

                    <div>
                      <div style={{ fontSize: '0.68rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Detection
                      </div>
                      <div style={{ fontSize: '0.92rem', fontWeight: 600, color: '#f8fafc', marginTop: '0.2rem' }}>
                        {isSearchback ? 'Search-back' : 'Primary'}
                      </div>
                    </div>
                  </div>

                  {/* Collapsible Detection Evidence Section */}
                  <div
                    style={{
                      border: '1px solid rgba(51, 65, 85, 0.6)',
                      borderRadius: '8px',
                      overflow: 'hidden',
                      background: 'rgba(15, 23, 42, 0.5)',
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => setIsEvidenceOpen(!isEvidenceOpen)}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        background: 'none',
                        border: 'none',
                        color: '#cbd5e1',
                        padding: '0.5rem 0.8rem',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        textAlign: 'left',
                      }}
                    >
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                        <Cpu size={14} color="#f59e0b" />
                        Detection Evidence &amp; Pan-Tompkins Criteria
                      </span>
                      {isEvidenceOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                    </button>

                    {isEvidenceOpen && (
                      <div
                        style={{
                          padding: '0.7rem 0.85rem',
                          borderTop: '1px solid rgba(51, 65, 85, 0.4)',
                          fontSize: '0.78rem',
                          color: '#94a3b8',
                          display: 'grid',
                          gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                          gap: '0.75rem',
                        }}
                      >
                        <div>
                          <strong style={{ color: '#e2e8f0', display: 'block', marginBottom: '0.2rem' }}>
                            Integration Threshold
                          </strong>
                          <div>TH_I1: <span style={{ color: '#f59e0b' }}>{selectedBeat.detection_evidence?.threshold_i1 ?? '--'}</span></div>
                          <div>TH_I2: <span style={{ color: '#fbbf24' }}>{selectedBeat.detection_evidence?.threshold_i2 ?? '--'}</span></div>
                        </div>

                        <div>
                          <strong style={{ color: '#e2e8f0', display: 'block', marginBottom: '0.2rem' }}>
                            Filtered Threshold
                          </strong>
                          <div>TH_F1: <span style={{ color: '#f59e0b' }}>{selectedBeat.detection_evidence?.threshold_f1 ?? '--'}</span></div>
                          <div>TH_F2: <span style={{ color: '#fbbf24' }}>{selectedBeat.detection_evidence?.threshold_f2 ?? '--'}</span></div>
                        </div>

                        <div>
                          <strong style={{ color: '#e2e8f0', display: 'block', marginBottom: '0.2rem' }}>
                            RR Condition
                          </strong>
                          <div>
                            {selectedBeat.detection_evidence?.rr_interval_ms
                              ? `${selectedBeat.detection_evidence.rr_interval_ms} ms (within 92%-116% RR2)`
                              : 'Initial adaptation period'}
                          </div>
                        </div>

                        <div>
                          <strong style={{ color: '#e2e8f0', display: 'block', marginBottom: '0.2rem' }}>
                            Refractory Period
                          </strong>
                          <div style={{ color: '#10b981' }}>Passed (&gt; 200 ms physiological blanking)</div>
                        </div>

                        <div>
                          <strong style={{ color: '#e2e8f0', display: 'block', marginBottom: '0.2rem' }}>
                            T-Wave Test
                          </strong>
                          <div style={{ color: '#10b981' }}>Passed (slope meets QRS criteria)</div>
                        </div>

                        <div>
                          <strong style={{ color: '#e2e8f0', display: 'block', marginBottom: '0.2rem' }}>
                            Final Decision
                          </strong>
                          <div style={{ color: isSearchback ? '#fbbf24' : '#34d399' }}>
                            {isSearchback
                              ? 'Recovered via Search-Back (PEAKI > TH_I2 & PEAKF > TH_F2)'
                              : 'Confirmed Primary QRS (PEAKI > TH_I1 & PEAKF > TH_F1)'}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Standard QRS Morphology Legend */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'flex-start',
                      gap: '1.2rem',
                      fontSize: '0.72rem',
                      color: '#94a3b8',
                      paddingTop: '0.25rem',
                      borderTop: '1px solid rgba(51, 65, 85, 0.4)',
                      flexWrap: 'wrap',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#f59e0b', display: 'inline-block' }} />
                      <span><strong>Q</strong> = Q-wave estimate</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444', display: 'inline-block' }} />
                      <span><strong>R</strong> = R-wave / fiducial estimate</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#38bdf8', display: 'inline-block' }} />
                      <span><strong>S</strong> = S-wave estimate</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <span style={{ width: 14, height: 8, borderRadius: '2px', background: 'rgba(59, 130, 246, 0.3)', border: '1px solid rgba(59, 130, 246, 0.6)', display: 'inline-block' }} />
                      <span><strong>QRS</strong> = detected complex (onset to offset)</span>
                    </div>
                  </div>
                </div>
              );
            })()}
          </section>
        </main>

        {/* ───────────────────────── Right 3D heart ───────────────────────── */}
        <section
          className="card"
          style={{
            ...cardStyle,
            padding: 0,
            position: 'relative',
            overflow: 'hidden',
            minHeight: 0,
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: '0.95rem',
              left: '1rem',
              right: '1rem',
              zIndex: 10,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              pointerEvents: 'none',
            }}
          >
            <span
              style={{
                fontSize: '0.95rem',
                fontWeight: 700,
                color: '#fbbf24',
                textShadow: '0 2px 6px rgba(0,0,0,0.55)',
              }}
            >
              Live 3D Cardiac Conduction
            </span>

            {/* <button
              type="button"
              aria-label="Expand heart viewer"
              title="Expand heart viewer"
              style={{
                pointerEvents: 'auto',
                width: 34,
                height: 34,
                borderRadius: 10,
                border: '1px solid rgba(148,163,184,0.45)',
                background: 'rgba(15,23,42,0.78)',
                color: '#e2e8f0',
                display: 'grid',
                placeItems: 'center',
                cursor: 'pointer',
              }}
              onClick={() => {}}
            >
              <Maximize2 size={17} />
            </button> */}
          </div>

          <div style={{ flex: 1, minHeight: 0 }}>
            <Canvas
              camera={{
                position: [0, 0, 4.5],
                fov: 42,
              }}
              dpr={[1, 2]}
              gl={{ antialias: true, alpha: true }}
            >
              <ambientLight intensity={1.15} />
              <directionalLight position={[5, 10, 7]} intensity={1.8} />
              <directionalLight position={[-5, -5, -3]} intensity={0.75} />
              <pointLight
                position={[0, 2, 4]}
                intensity={1.35}
                color="#ffffff"
              />

              <Suspense
                fallback={
                  <mesh>
                    <sphereGeometry args={[0.7, 16, 16]} />
                    <meshStandardMaterial
                      color="#b91c1c"
                      wireframe
                      transparent
                      opacity={0.3}
                    />
                  </mesh>
                }
              >
                <HeartModel
                  phase={playbackState.phase || 'diastole'}
                  progress={playbackState.phaseProgress || 0}
                />
              </Suspense>

              <OrbitControls
                enableZoom={true}
                autoRotate={!playbackState.isPlaying}
                autoRotateSpeed={0.55}
                minDistance={2.9}
                maxDistance={6}
                target={[0, 0, 0]}
              />
            </Canvas>
          </div>

          <div
            style={{
              position: 'absolute',
              bottom: '0.85rem',
              left: '1rem',
              zIndex: 10,
              fontSize: '0.68rem',
              color: '#94a3b8',
              background: 'rgba(15,23,42,0.72)',
              padding: '0.3rem 0.55rem',
              borderRadius: 7,
              pointerEvents: 'none',
            }}
          >
            Drag to rotate • Scroll to zoom
          </div>
        </section>
      </div>

      {/* Small-screen fallback */}
      <style>{`
        @media (max-width: 1200px) {
          .dashboard-grid {
            grid-template-columns: minmax(200px, 220px) minmax(0, 1fr) !important;
          }

          .dashboard-grid > section:last-child {
            grid-column: 1 / -1;
            min-height: 600px;
          }
        }

        @media (max-width: 800px) {
          .header {
            flex-direction: column;
            align-items: flex-start !important;
          }

          .dashboard-grid {
            grid-template-columns: 1fr !important;
          }

          .dashboard-grid > section:last-child {
            grid-column: auto;
            min-height: 560px;
          }

          .metrics-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}

export default App;

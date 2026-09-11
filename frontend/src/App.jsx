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
        name: `${activeStage.charAt(0).toUpperCase() + activeStage.slice(1)}`,
        line: { color: '#3b82f6', width: 2 },
      },
    ];

    if (activeStage === 'original' && data.stages.peaks_original) {
      const searchbackSet = new Set(data.stages.searchback || []);
      const normalPeaks = data.stages.peaks_original.filter((p) => !searchbackSet.has(p));
      const sbPeaks = data.stages.peaks_original.filter((p) => searchbackSet.has(p));

      plotData.push({
        x: normalPeaks.map((p) => p / fs),
        y: normalPeaks.map((p) => signalData[p]),
        type: 'scatter',
        mode: 'markers',
        name: 'Detected QRS (Normal)',
        marker: {
          color: '#ef4444',
          size: 10,
          symbol: 'circle-open',
          line: { width: 2 },
        },
      });

      if (sbPeaks.length > 0) {
        plotData.push({
          x: sbPeaks.map((p) => p / fs),
          y: sbPeaks.map((p) => signalData[p]),
          type: 'scatter',
          mode: 'markers',
          name: 'Search-Back QRS',
          marker: {
            color: '#f59e0b',
            size: 12,
            symbol: 'diamond',
            line: { width: 2 },
          },
        });
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

    const hasMultiTraces = ['integrated', 'bandpass'].includes(activeStage) ||
      (activeStage === 'original' && (data.stages.searchback?.length > 0));

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
              range: [0, DURATION],
              fixedrange: true,
            },
            yaxis: {
              title: { text: 'Amplitude', standoff: 8 },
              gridcolor: '#334155',
              zerolinecolor: '#334155',
              fixedrange: true,
            },
            showlegend: hasMultiTraces,
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
            displayModeBar: false,
            staticPlot: true,
          }}
        />

        {/* Playback cursor */}
        <div
          style={{
            position: 'absolute',
            top: 14,
            bottom: 52,
            left: `calc(58px + (100% - 76px) * (${playbackState.currentTime} / ${DURATION}))`,
            width: 2,
            backgroundColor: '#ef4444',
            zIndex: 10,
            boxShadow: '0 0 10px rgba(239,68,68,0.8)',
            pointerEvents: 'none',
            transition: 'none',
          }}
        />
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
                      className={`alert ${
                        abn.includes('Normal') ? 'success' : 'danger'
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

          {/* ECG stage viewer gets essentially all center-column height */}
          <section
            className="card"
            style={{
              ...cardStyle,
              minHeight: 0,
              padding: '0.9rem',
              display: 'grid',
              gridTemplateRows: 'auto minmax(0, 1fr)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '1rem',
                marginBottom: '0.8rem',
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
                  gap: '0.2rem',
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
                    className={`stage-btn ${
                      activeStage === stage ? 'active' : ''
                    }`}
                    onClick={() => setActiveStage(stage)}
                  >
                    {stage.charAt(0).toUpperCase() + stage.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            <div
              className="plot-container"
              style={{
                position: 'relative',
                minHeight: 0,
                height: '100%',
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

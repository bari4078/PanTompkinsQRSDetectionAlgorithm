import React, { useState, useEffect, Suspense } from 'react';
import Plot from 'react-plotly.js';
import { Activity, Heart, ActivitySquare, AlertTriangle, CheckCircle2 } from 'lucide-react';
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
      .then(data => {
        if (data.records && data.records.length > 0) {
          setRecords(data.records);
          setSelectedRecord(data.records[0]);
        }
      })
      .catch(err => console.error("Failed to fetch records:", err));
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
          lowcut: lowcut,
          highcut: highcut
        })
      });

      if (!response.ok) {
        throw new Error("Failed to process signal");
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
    const timeAxis = Array.from({length: signalData.length}, (_, i) => i / fs);

    const plotData = [
      {
        x: timeAxis,
        y: signalData,
        type: 'scatter',
        mode: 'lines',
        name: 'ECG Signal',
        line: { color: '#3b82f6', width: 2 }
      }
    ];

    if (activeStage === 'original' && data.stages.peaks_original) {
      const peakTimes = data.stages.peaks_original.map(p => p / fs);
      const peakValues = data.stages.peaks_original.map(p => signalData[p]);
      plotData.push({
        x: peakTimes, y: peakValues, type: 'scatter', mode: 'markers',
        name: 'Detected R-Peaks', marker: { color: '#ef4444', size: 10, symbol: 'circle-open', line: {width: 2} }
      });
    }

    return (
      <div style={{ position: 'relative', width: '100%', height: '100%' }}>
        <Plot
          data={plotData}
          layout={{
            autosize: true, margin: { l: 50, r: 20, t: 20, b: 50 },
            paper_bgcolor: 'transparent', plot_bgcolor: 'transparent',
            font: { color: '#94a3b8' },
            xaxis: { title: 'Time (Seconds)', gridcolor: '#334155', zerolinecolor: '#334155', range: [0, DURATION] },
            yaxis: { title: 'Amplitude', gridcolor: '#334155', zerolinecolor: '#334155' },
            showlegend: false
          }}
          useResizeHandler={true}
          style={{ width: '100%', height: '100%' }}
          config={{ responsive: true, displayModeBar: false, staticPlot: true }}
        />
        {/* Playback Cursor Overlay — reads from centralized engine */}
        <div
          style={{
            position: 'absolute', top: '20px', bottom: '50px',
            left: `calc(50px + (100% - 70px) * (${playbackState.currentTime} / ${DURATION}))`,
            width: '2px', backgroundColor: '#ef4444', zIndex: 10,
            boxShadow: '0 0 10px #ef4444', pointerEvents: 'none',
            transition: 'none'
          }}
        />
      </div>
    );
  };

  return (
    <div className="app-container">
      <header className="header">
        <h1>Pan-Tompkins Algorithm</h1>
        <p>Advanced QRS Detection & Cardiac Conduction Visualization</p>
      </header>

      <div className="dashboard-grid">
        {/* Sidebar Controls */}
        <div className="card">
          <h2><Activity size={24} /> Parameters</h2>

          <div className="form-group">
            <label>MIT-BIH Record</label>
            <select className="form-control" value={selectedRecord} onChange={(e) => setSelectedRecord(e.target.value)}>
              {records.map(rec => <option key={rec} value={rec}>Record {rec}</option>)}
            </select>
          </div>

          <div className="form-group">
            <label>Bandpass Lowcut <span>{lowcut.toFixed(1)} Hz</span></label>
            <input type="range" className="range-slider" min="1" max="10" step="0.5" value={lowcut} onChange={(e) => setLowcut(Number(e.target.value))} />
          </div>

          <div className="form-group">
            <label>Bandpass Highcut <span>{highcut.toFixed(1)} Hz</span></label>
            <input type="range" className="range-slider" min="10" max="30" step="0.5" value={highcut} onChange={(e) => setHighcut(Number(e.target.value))} />
          </div>

          <button className="btn" onClick={processSignal} disabled={loading}>
            {loading ? 'Processing...' : 'Apply & Process'}
          </button>

          {error && <div style={{color: '#ef4444', marginTop: '1rem', fontSize: '0.875rem'}}>Error: {error}</div>}
        </div>

        {/* Main Content */}
        <div>
          {/* Top Row: Metrics & Heart Visualizer */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '2rem', marginBottom: '2rem' }}>
            {/* Metrics Dashboard */}
            <div className="metrics-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)', marginBottom: 0 }}>
              <div className="metric-card">
                <div className="metric-label">Heart Rate</div>
                <div className="metric-value" style={{display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem'}}>
                  <Heart size={20} color="#ef4444" />
                  {data ? `${data.analysis.hr_bpm} BPM` : '--'}
                </div>
              </div>
              <div className="metric-card">
                <div className="metric-label">HRV (SDNN)</div>
                <div className="metric-value">{data ? `${data.analysis.sdnn_ms} ms` : '--'}</div>
              </div>
              <div className="metric-card" style={{ gridColumn: 'span 2', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <div className="metric-label" style={{marginBottom: '0.5rem'}}>Rhythm Status</div>
                <div className="abnormalities">
                  {data ? (
                    data.analysis.abnormalities.map((abn, i) => (
                      <div key={i} className={`alert ${abn.includes('Normal') ? 'success' : 'danger'}`}>
                        {abn.includes('Normal') ? <CheckCircle2 size={16}/> : <AlertTriangle size={16}/>}
                        {abn}
                      </div>
                    ))
                  ) : (<div style={{color: 'var(--text-muted)'}}>Waiting for data...</div>)}
                </div>
              </div>
            </div>

            {/* 3D HEART VIEWER */}
            <div className="card" style={{ padding: 0, height: '340px', overflow: 'hidden', position: 'relative' }}>
              <div style={{ position: 'absolute', top: '10px', left: '10px', zIndex: 10, display: 'flex', alignItems: 'center', gap: '8px', pointerEvents: 'none' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#fbbf24', textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>
                  Live 3D Conduction
                </span>
                {/* <span style={{ fontSize: '0.68rem', color: '#38bdf8', background: 'rgba(15,23,42,0.85)', padding: '2px 8px', borderRadius: '9999px', border: '1px solid rgba(56,189,248,0.35)' }}>
                  Anatomical Landmarks
                </span> */}
              </div>
              <div style={{ position: 'absolute', bottom: '8px', right: '10px', zIndex: 10, fontSize: '0.7rem', color: '#94a3b8', background: 'rgba(15,23,42,0.7)', padding: '2px 8px', borderRadius: '4px', pointerEvents: 'none' }}>
                Drag to rotate • Scroll to zoom
              </div>
              <Canvas camera={{ position: [0, 0, 4.2], fov: 45 }}>
                <ambientLight intensity={1.2} />
                <directionalLight position={[5, 10, 7]} intensity={1.8} />
                <directionalLight position={[-5, -5, -3]} intensity={0.8} />
                <pointLight position={[0, 2, 4]} intensity={1.2} color="#ffffff" />
                <Suspense fallback={
                  <mesh>
                    <sphereGeometry args={[0.7, 16, 16]} />
                    <meshStandardMaterial color="#b91c1c" wireframe transparent opacity={0.3} />
                  </mesh>
                }>
                  <HeartModel
                    phase={playbackState.phase || 'diastole'}
                    progress={playbackState.phaseProgress || 0}
                  />
                </Suspense>
                <OrbitControls enableZoom={true} autoRotate={!playbackState.isPlaying} autoRotateSpeed={0.8} />
              </Canvas>
            </div>
          </div>

          {/* Playback Controls + Stats */}
          <div className="card" style={{ padding: '1rem', marginBottom: '2rem' }}>
            <PlaybackControls
              state={playbackState}
              controls={playbackControls}
              duration={DURATION}
            />
            <div style={{ marginTop: '0.75rem', borderTop: '1px solid #334155', paddingTop: '0.75rem' }}>
              <PlaybackStats
                state={playbackState}
                duration={DURATION}
                totalBeats={rPeaks.length}
              />
            </div>
          </div>

          {/* Signal Viewer */}
          <div className="card" style={{padding: '1rem'}}>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', padding: '0 0.5rem'}}>
              <h2><ActivitySquare size={24} /> Algorithm Stages</h2>
              <div className="stage-selector" style={{ marginBottom: 0 }}>
                {['original', 'bandpass', 'derivative', 'squared', 'integrated'].map(stage => (
                  <button key={stage} className={`stage-btn ${activeStage === stage ? 'active' : ''}`} onClick={() => setActiveStage(stage)}>
                    {stage.charAt(0).toUpperCase() + stage.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            <div className="plot-container">
              {loading && <div className="loading-overlay"><Activity size={32} /><span>Processing Signal...</span></div>}
              {renderPlot()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;

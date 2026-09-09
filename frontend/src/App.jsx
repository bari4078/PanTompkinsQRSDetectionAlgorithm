import React, { useState, useEffect, useRef } from 'react';
import Plot from 'react-plotly.js';
import { Activity, Heart, ActivitySquare, AlertTriangle, CheckCircle2, Play, Pause, Square } from 'lucide-react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment } from '@react-three/drei';
import HeartModel from './HeartModel';
import './index.css';

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

  // --- PLAYBACK STATE ---
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackTime, setPlaybackTime] = useState(0); // 0 to 10 seconds
  const animationRef = useRef(null);
  const lastTimeRef = useRef(null);
  const duration = 10; // seconds

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
    setIsPlaying(false);
    setPlaybackTime(0);
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

  // --- PLAYBACK LOOP ---
  useEffect(() => {
    if (isPlaying) {
      const loop = (time) => {
        if (lastTimeRef.current != null) {
          const delta = (time - lastTimeRef.current) / 1000;
          setPlaybackTime(prev => {
            let next = prev + delta;
            if (next >= duration) {
              next = 0; // Loop playback
            }
            return next;
          });
        }
        lastTimeRef.current = time;
        animationRef.current = requestAnimationFrame(loop);
      };
      animationRef.current = requestAnimationFrame(loop);
    } else {
      lastTimeRef.current = null;
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    }
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [isPlaying, duration]);

  const togglePlayback = () => setIsPlaying(!isPlaying);
  const stopPlayback = () => {
    setIsPlaying(false);
    setPlaybackTime(0);
  };

  const renderPlot = () => {
    if (!data) return null;
    
    const fs = data.fs;
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
            xaxis: { title: 'Time (Seconds)', gridcolor: '#334155', zerolinecolor: '#334155', range: [0, duration] },
            yaxis: { title: 'Amplitude', gridcolor: '#334155', zerolinecolor: '#334155' },
            showlegend: false
          }}
          useResizeHandler={true}
          style={{ width: '100%', height: '100%' }}
          config={{ responsive: true, displayModeBar: false, staticPlot: true }}
        />
        {/* Playback Cursor Overlay */}
        <div 
          style={{
            position: 'absolute', top: '20px', bottom: '50px',
            left: `calc(50px + (100% - 70px) * (${playbackTime} / ${duration}))`,
            width: '2px', backgroundColor: '#ef4444', zIndex: 10,
            boxShadow: '0 0 10px #ef4444', pointerEvents: 'none',
            transition: 'none' // Important to avoid CSS delay in raf
          }}
        />
      </div>
    );
  };

  return (
    <div className="app-container">
      <header className="header">
        <h1>Pan-Tompkins Algorithm</h1>
        <p>Advanced QRS Detection & 3D Arrhythmia Analysis</p>
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

          {/* PLAYBACK CONTROLS */}
          <h2 style={{ marginTop: '2rem' }}><Heart size={24} /> Playback</h2>
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
            <button className="btn" style={{ flex: 1, backgroundColor: isPlaying ? '#475569' : '#10b981' }} onClick={togglePlayback}>
              {isPlaying ? <Pause size={18} /> : <Play size={18} />} {isPlaying ? 'Pause' : 'Play Signal'}
            </button>
            <button className="btn" style={{ flex: 0.3, backgroundColor: '#ef4444' }} onClick={stopPlayback}>
              <Square size={18} />
            </button>
          </div>
          
          <div className="form-group">
            <label>Timeline <span>{playbackTime.toFixed(2)}s / {duration}s</span></label>
            <input 
              type="range" 
              className="range-slider"
              min="0" max={duration} step="0.01"
              value={playbackTime}
              onChange={(e) => {
                setPlaybackTime(Number(e.target.value));
                setIsPlaying(false);
              }}
            />
          </div>
        </div>

        {/* Main Content */}
        <div>
          {/* Top Row: Metrics & 3D Heart */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '2rem', marginBottom: '2rem' }}>
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
            <div className="card" style={{ padding: 0, height: '240px', overflow: 'hidden', position: 'relative' }}>
              <div style={{ position: 'absolute', top: '10px', left: '10px', zIndex: 10, fontSize: '0.8rem', fontWeight: 600, color: '#fbbf24', textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>
                Live 3D Conduction
              </div>
              <Canvas camera={{ position: [0, 0, 5], fov: 45 }}>
                <ambientLight intensity={0.5} />
                <directionalLight position={[10, 10, 5]} intensity={1} />
                <Environment preset="city" />
                <HeartModel 
                  currentTime={playbackTime} 
                  fs={data?.fs || 360} 
                  peaks={data?.stages?.peaks_original || []} 
                />
                <OrbitControls enableZoom={false} autoRotate={!isPlaying} autoRotateSpeed={1} />
              </Canvas>
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

import React, { useState, useEffect } from 'react';
import Plot from 'react-plotly.js';
import { Activity, Heart, ActivitySquare, AlertTriangle, CheckCircle2 } from 'lucide-react';
import './index.css';

function App() {
  // State for controls
  const [records, setRecords] = useState([]);
  const [selectedRecord, setSelectedRecord] = useState('100');
  const [windowSize, setWindowSize] = useState(150);
  const [lowcut, setLowcut] = useState(5.0);
  const [highcut, setHighcut] = useState(15.0);
  
  // State for data
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // State for UI
  const [activeStage, setActiveStage] = useState('original');

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

  // Process the signal by calling the backend
  const processSignal = async () => {
    setLoading(true);
    setError(null);
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

  // Run processing when records load or when the selected record changes
  useEffect(() => {
    if (records.length > 0) {
      processSignal();
    }
  }, [records, selectedRecord]); // Auto-update when record changes

  // Chart rendering logic using Plotly
  const renderPlot = () => {
    if (!data) return null;
    
    const fs = data.fs;
    const signalData = data.stages[activeStage];
    
    // Create time axis (x-axis)
    const timeAxis = Array.from({length: signalData.length}, (_, i) => i / fs);
    
    // Main signal line
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

    // Add peak markers depending on which stage we are looking at
    if (activeStage === 'original' && data.stages.peaks_original) {
      const peakTimes = data.stages.peaks_original.map(p => p / fs);
      const peakValues = data.stages.peaks_original.map(p => signalData[p]);
      
      plotData.push({
        x: peakTimes,
        y: peakValues,
        type: 'scatter',
        mode: 'markers',
        name: 'Detected R-Peaks',
        marker: { color: '#ef4444', size: 10, symbol: 'circle-open', line: {width: 2} }
      });
    } else if (activeStage === 'integrated' && data.stages.peaks_integrated) {
      const peakTimes = data.stages.peaks_integrated.map(p => p / fs);
      const peakValues = data.stages.peaks_integrated.map(p => signalData[p]);
      
      plotData.push({
        x: peakTimes,
        y: peakValues,
        type: 'scatter',
        mode: 'markers',
        name: 'Peaks (Integrated)',
        marker: { color: '#ef4444', size: 8 }
      });
      
      // Add threshold line on the integrated stage
      plotData.push({
        x: [timeAxis[0], timeAxis[timeAxis.length - 1]],
        y: [data.stages.threshold, data.stages.threshold],
        type: 'scatter',
        mode: 'lines',
        name: 'Threshold',
        line: { color: '#f59e0b', width: 2, dash: 'dash' }
      });
    }

    return (
      <Plot
        data={plotData}
        layout={{
          autosize: true,
          margin: { l: 50, r: 20, t: 20, b: 50 },
          paper_bgcolor: 'transparent',
          plot_bgcolor: 'transparent',
          font: { color: '#94a3b8' },
          xaxis: { 
            title: 'Time (Seconds)', 
            gridcolor: '#334155',
            zerolinecolor: '#334155'
          },
          yaxis: { 
            title: 'Amplitude',
            gridcolor: '#334155',
            zerolinecolor: '#334155'
          },
          showlegend: true,
          legend: { orientation: 'h', y: 1.1 }
        }}
        useResizeHandler={true}
        style={{ width: '100%', height: '100%' }}
        config={{ responsive: true, displayModeBar: true, scrollZoom: true }}
      />
    );
  };

  return (
    <div className="app-container">
      <header className="header">
        <h1>Pan-Tompkins Algorithm</h1>
        <p>Advanced QRS Detection & Arrhythmia Analysis</p>
      </header>

      <div className="dashboard-grid">
        {/* Sidebar Controls */}
        <div className="card">
          <h2><Activity size={24} /> Parameters</h2>
          
          <div className="form-group">
            <label>MIT-BIH Record</label>
            <select 
              className="form-control" 
              value={selectedRecord}
              onChange={(e) => setSelectedRecord(e.target.value)}
            >
              {records.map(rec => (
                <option key={rec} value={rec}>Record {rec}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>
              Integration Window
              <span>{windowSize} ms</span>
            </label>
            <input 
              type="range" 
              className="range-slider"
              min="50" max="300" step="10"
              value={windowSize}
              onChange={(e) => setWindowSize(Number(e.target.value))}
            />
          </div>
          
          <div className="form-group">
            <label>
              Bandpass Lowcut
              <span>{lowcut.toFixed(1)} Hz</span>
            </label>
            <input 
              type="range" 
              className="range-slider"
              min="1" max="10" step="0.5"
              value={lowcut}
              onChange={(e) => setLowcut(Number(e.target.value))}
            />
          </div>

          <div className="form-group">
            <label>
              Bandpass Highcut
              <span>{highcut.toFixed(1)} Hz</span>
            </label>
            <input 
              type="range" 
              className="range-slider"
              min="10" max="30" step="0.5"
              value={highcut}
              onChange={(e) => setHighcut(Number(e.target.value))}
            />
          </div>

          <button 
            className="btn" 
            onClick={processSignal}
            disabled={loading}
          >
            {loading ? 'Processing...' : 'Apply & Process'}
          </button>
          
          {error && (
            <div style={{color: '#ef4444', marginTop: '1rem', fontSize: '0.875rem'}}>
              Error: {error}
            </div>
          )}
        </div>

        {/* Main Content */}
        <div>
          {/* Metrics Dashboard */}
          <div className="metrics-grid">
            <div className="metric-card">
              <div className="metric-label">Heart Rate</div>
              <div className="metric-value" style={{display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem'}}>
                <Heart size={20} color="#ef4444" />
                {data ? `${data.analysis.hr_bpm} BPM` : '--'}
              </div>
            </div>
            
            <div className="metric-card">
              <div className="metric-label">HRV (SDNN)</div>
              <div className="metric-value">
                {data ? `${data.analysis.sdnn_ms} ms` : '--'}
              </div>
            </div>
            
            <div className="metric-card">
              <div className="metric-label">Est. Blood Pressure</div>
              <div className="metric-value">
                {data ? data.analysis.simulated_bp : '--'}
              </div>
            </div>

            <div className="metric-card" style={{display: 'flex', flexDirection: 'column', justifyContent: 'center'}}>
              <div className="metric-label" style={{marginBottom: '0.5rem'}}>Rhythm Status</div>
              <div className="abnormalities">
                {data ? (
                  data.analysis.abnormalities.map((abn, i) => (
                    <div key={i} className={`alert ${abn.includes('Normal') ? 'success' : 'danger'}`}>
                      {abn.includes('Normal') ? <CheckCircle2 size={16}/> : <AlertTriangle size={16}/>}
                      {abn}
                    </div>
                  ))
                ) : (
                  <div style={{color: 'var(--text-muted)'}}>Waiting for data...</div>
                )}
              </div>
            </div>
          </div>

          {/* Signal Viewer */}
          <div className="card" style={{padding: '1rem'}}>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', padding: '0 0.5rem'}}>
              <h2><ActivitySquare size={24} /> Algorithm Stages</h2>
            </div>
            
            <div className="stage-selector">
              {['original', 'bandpass', 'derivative', 'squared', 'integrated'].map(stage => (
                <button
                  key={stage}
                  className={`stage-btn ${activeStage === stage ? 'active' : ''}`}
                  onClick={() => setActiveStage(stage)}
                >
                  {stage.charAt(0).toUpperCase() + stage.slice(1)}
                </button>
              ))}
            </div>

            <div className="plot-container">
              {loading && (
                <div className="loading-overlay">
                  <Activity size={32} />
                  <span>Processing Signal...</span>
                </div>
              )}
              {renderPlot()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Plot from 'react-plotly.js';
import {
  ShieldCheck,
  AlertTriangle,
  RefreshCw,
  Database,
  Award,
} from 'lucide-react';

export default function EvaluationPanel({
  currentRecordId = '100',
  availableRecords = [],
  detectorParams = { windowSizeMs: 150, lowcut: 5.0, highcut: 15.0 },
}) {
  const [scope, setScope] = useState('current'); // 'current' | 'custom' | 'all'
  const [selectedRecords, setSelectedRecords] = useState([currentRecordId]);
  const [toleranceMs, setToleranceMs] = useState(150);
  const [durationSec, setDurationSec] = useState(60); // 10, 60, 300, or null (full)
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [benchmarkResult, setBenchmarkResult] = useState(null);
  const [inspectedRecordId, setInspectedRecordId] = useState(currentRecordId);
  const [eventFilter, setEventFilter] = useState('ALL'); // 'ALL' | 'TP' | 'FP' | 'FN'

  // Update selectedRecords when currentRecordId changes and scope is 'current'
  useEffect(() => {
    if (scope === 'current') {
      setSelectedRecords([currentRecordId]);
      setInspectedRecordId(currentRecordId);
    }
  }, [currentRecordId, scope]);

  // Handle run evaluation
  const runEvaluation = useCallback(async () => {
    setLoading(true);
    setError(null);

    let recordsToEvaluate = [];
    if (scope === 'current') {
      recordsToEvaluate = [currentRecordId];
    } else if (scope === 'custom') {
      recordsToEvaluate = selectedRecords.length > 0 ? selectedRecords : [currentRecordId];
    } else {
      recordsToEvaluate = availableRecords.length > 0 ? availableRecords : [];
    }

    try {
      const payload = {
        record_ids: recordsToEvaluate.length > 0 ? recordsToEvaluate : null,
        tolerance_ms: Number(toleranceMs),
        duration_sec: durationSec ? Number(durationSec) : null,
        window_size_ms: detectorParams.windowSizeMs,
        lowcut: detectorParams.lowcut,
        highcut: detectorParams.highcut,
      };

      const res = await fetch('http://localhost:8000/api/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || `Server error ${res.status}`);
      }

      const data = await res.json();
      setBenchmarkResult(data);

      // Default inspected record to first returned record if current is not in response
      if (data.records && data.records.length > 0) {
        const found = data.records.find((r) => r.record_id === inspectedRecordId);
        if (!found) {
          setInspectedRecordId(data.records[0].record_id);
        }
      }
    } catch (err) {
      console.error('Benchmark execution failed:', err);
      setError(err.message || 'Failed to execute evaluation benchmark.');
    } finally {
      setLoading(false);
    }
  }, [
    scope,
    currentRecordId,
    selectedRecords,
    availableRecords,
    toleranceMs,
    durationSec,
    detectorParams,
    inspectedRecordId,
  ]);

  // Run benchmark on initial mount
  useEffect(() => {
    runEvaluation();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Get currently inspected record data
  const inspectedRecord = useMemo(() => {
    if (!benchmarkResult || !benchmarkResult.records) return null;
    return (
      benchmarkResult.records.find((r) => r.record_id === inspectedRecordId) ||
      benchmarkResult.records[0]
    );
  }, [benchmarkResult, inspectedRecordId]);

  // Filtered audit events
  const filteredEvents = useMemo(() => {
    if (!inspectedRecord || !inspectedRecord.events_audit) return [];
    if (eventFilter === 'ALL') return inspectedRecord.events_audit;
    return inspectedRecord.events_audit.filter((ev) => ev.classification === eventFilter);
  }, [inspectedRecord, eventFilter]);

  // Prepare Plotly Traces for Inspected Record
  const plotData = useMemo(() => {
    if (!inspectedRecord || !inspectedRecord.visualization) return [];

    const vis = inspectedRecord.visualization;
    const timeArr = vis.time || [];
    const signalArr = vis.signal || [];
    const events = vis.events || [];

    // 1. Raw ECG trace
    const traces = [
      {
        x: timeArr,
        y: signalArr,
        type: 'scatter',
        mode: 'lines',
        name: 'ECG Signal (MLII)',
        line: { color: '#60a5fa', width: 1.5 },
        hoverinfo: 'x+y',
      },
    ];

    // Separate events by classification
    const tpEvents = events.filter((e) => e.classification === 'TP');
    const fpEvents = events.filter((e) => e.classification === 'FP');
    const fnEvents = events.filter((e) => e.classification === 'FN');

    // 2. Reference Beats (Ground Truth)
    const refTimes = [];
    const refAmps = [];
    const refHover = [];
    const refText = [];

    events.forEach((e) => {
      if (e.reference_sample !== null && e.reference_time_sec !== undefined) {
        const samp = e.reference_sample;
        const time = e.reference_time_sec;
        const amp = samp < signalArr.length ? signalArr[samp] : 0;
        refTimes.push(time);
        refAmps.push(amp);
        refText.push(e.symbol || 'N');
        refHover.push(
          `<b>Ground Truth Beat</b><br>Symbol: ${e.symbol || 'N'}<br>Time: ${time.toFixed(3)}s<br>Sample: ${samp}`
        );
      }
    });

    if (refTimes.length > 0) {
      traces.push({
        x: refTimes,
        y: refAmps,
        type: 'scatter',
        mode: 'markers+text',
        name: 'Reference Annotation (GT)',
        text: refText,
        textposition: 'top center',
        textfont: { color: '#38bdf8', size: 10, family: 'monospace' },
        marker: {
          symbol: 'circle-open',
          size: 11,
          color: '#38bdf8',
          line: { width: 2, color: '#38bdf8' },
        },
        hoverinfo: 'text',
        hovertext: refHover,
      });
    }

    // 3. True Positives (Matched Detections)
    if (tpEvents.length > 0) {
      const tpTimes = [];
      const tpAmps = [];
      const tpHover = [];

      tpEvents.forEach((e) => {
        const dSamp = e.detected_sample;
        const dTime = e.detected_time_sec;
        const amp = dSamp < signalArr.length ? signalArr[dSamp] : 0;
        tpTimes.push(dTime);
        tpAmps.push(amp);
        tpHover.push(
          `<b>✓ Matched (True Positive)</b><br>Ref Symbol: ${e.symbol}<br>Det Time: ${dTime.toFixed(3)}s<br>Ref Time: ${e.reference_time_sec?.toFixed(3)}s<br>Δt: ${e.delta_ms > 0 ? '+' : ''}${e.delta_ms} ms`
        );
      });

      traces.push({
        x: tpTimes,
        y: tpAmps,
        type: 'scatter',
        mode: 'markers',
        name: `Matched TP (${tpEvents.length})`,
        marker: {
          symbol: 'circle',
          size: 7,
          color: '#10b981',
          line: { width: 1, color: '#047857' },
        },
        hoverinfo: 'text',
        hovertext: tpHover,
      });
    }

    // 4. False Positives (Unmatched Detections)
    if (fpEvents.length > 0) {
      const fpTimes = [];
      const fpAmps = [];
      const fpHover = [];

      fpEvents.forEach((e) => {
        const dSamp = e.detected_sample;
        const dTime = e.detected_time_sec;
        const amp = dSamp < signalArr.length ? signalArr[dSamp] : 0;
        fpTimes.push(dTime);
        fpAmps.push(amp);
        fpHover.push(
          `<b>⚠ False Positive</b><br>Extra Detection (no ref beat within ±${toleranceMs}ms)<br>Time: ${dTime.toFixed(3)}s<br>Sample: ${dSamp}`
        );
      });

      traces.push({
        x: fpTimes,
        y: fpAmps,
        type: 'scatter',
        mode: 'markers',
        name: `False Positive (${fpEvents.length})`,
        marker: {
          symbol: 'triangle-up',
          size: 10,
          color: '#f59e0b',
          line: { width: 1.5, color: '#b45309' },
        },
        hoverinfo: 'text',
        hovertext: fpHover,
      });
    }

    // 5. False Negatives (Missed Reference Beats)
    if (fnEvents.length > 0) {
      const fnTimes = [];
      const fnAmps = [];
      const fnHover = [];

      fnEvents.forEach((e) => {
        const rSamp = e.reference_sample;
        const rTime = e.reference_time_sec;
        const amp = rSamp < signalArr.length ? signalArr[rSamp] : 0;
        fnTimes.push(rTime);
        fnAmps.push(amp);
        fnHover.push(
          `<b>✕ False Negative</b><br>Missed Beat Symbol: ${e.symbol}<br>Time: ${rTime.toFixed(3)}s<br>Sample: ${rSamp}`
        );
      });

      traces.push({
        x: fnTimes,
        y: fnAmps,
        type: 'scatter',
        mode: 'markers',
        name: `False Negative (${fnEvents.length})`,
        marker: {
          symbol: 'triangle-down',
          size: 10,
          color: '#ef4444',
          line: { width: 1.5, color: '#991b1b' },
        },
        hoverinfo: 'text',
        hovertext: fnHover,
      });
    }

    return traces;
  }, [inspectedRecord, toleranceMs]);

  // Overall aggregate metrics
  const summary = benchmarkResult?.summary;
  const paperRef = benchmarkResult?.paper_reference;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', width: '100%' }}>
      {/* ───────────────────────── Top Controls Header ───────────────────────── */}
      <div
        className="card"
        style={{
          background: 'rgba(15, 23, 42, 0.75)',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(51, 65, 85, 0.45)',
          borderRadius: '12px',
          padding: '1.1rem 1.25rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.8rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
              <Award size={20} color="#38bdf8" />
              <h2 style={{ margin: 0, fontSize: '1.15rem', color: '#f8fafc', fontWeight: 600 }}>
                Pan-Tompkins Reference Evaluation Benchmark
              </h2>
            </div>
            <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.82rem', color: '#94a3b8' }}>
              ANSI/AAMI EC57 standard QRS complex detection benchmarking against MIT-BIH reference annotations (`.atr`).
            </p>
          </div>

          <button
            type="button"
            onClick={runEvaluation}
            disabled={loading}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.6rem 1.1rem',
              background: loading ? 'rgba(56, 189, 248, 0.2)' : 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
              color: '#ffffff',
              border: '1px solid #38bdf8',
              borderRadius: '8px',
              fontSize: '0.88rem',
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s ease',
              boxShadow: '0 4px 12px rgba(2, 132, 199, 0.25)',
            }}
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            {loading ? 'Running Benchmark...' : 'Run Benchmark'}
          </button>
        </div>

        {/* Configuration Row */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '1rem',
            paddingTop: '0.85rem',
            borderTop: '1px solid rgba(51, 65, 85, 0.4)',
          }}
        >
          {/* Scope Selector */}
          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', color: '#94a3b8', marginBottom: '0.35rem', fontWeight: 500 }}>
              Evaluation Scope
            </label>
            <div style={{ display: 'flex', gap: '0.35rem' }}>
              <button
                type="button"
                onClick={() => setScope('current')}
                style={{
                  flex: 1,
                  padding: '0.45rem 0.5rem',
                  fontSize: '0.78rem',
                  borderRadius: '6px',
                  border: scope === 'current' ? '1px solid #38bdf8' : '1px solid rgba(51, 65, 85, 0.6)',
                  background: scope === 'current' ? 'rgba(56, 189, 248, 0.15)' : 'rgba(15, 23, 42, 0.6)',
                  color: scope === 'current' ? '#38bdf8' : '#94a3b8',
                  cursor: 'pointer',
                  fontWeight: 500,
                }}
              >
                Current ({currentRecordId})
              </button>
              <button
                type="button"
                onClick={() => setScope('custom')}
                style={{
                  flex: 1,
                  padding: '0.45rem 0.5rem',
                  fontSize: '0.78rem',
                  borderRadius: '6px',
                  border: scope === 'custom' ? '1px solid #38bdf8' : '1px solid rgba(51, 65, 85, 0.6)',
                  background: scope === 'custom' ? 'rgba(56, 189, 248, 0.15)' : 'rgba(15, 23, 42, 0.6)',
                  color: scope === 'custom' ? '#38bdf8' : '#94a3b8',
                  cursor: 'pointer',
                  fontWeight: 500,
                }}
              >
                Custom Selection
              </button>
              <button
                type="button"
                onClick={() => setScope('all')}
                style={{
                  flex: 1,
                  padding: '0.45rem 0.5rem',
                  fontSize: '0.78rem',
                  borderRadius: '6px',
                  border: scope === 'all' ? '1px solid #38bdf8' : '1px solid rgba(51, 65, 85, 0.6)',
                  background: scope === 'all' ? 'rgba(56, 189, 248, 0.15)' : 'rgba(15, 23, 42, 0.6)',
                  color: scope === 'all' ? '#38bdf8' : '#94a3b8',
                  cursor: 'pointer',
                  fontWeight: 500,
                }}
              >
                All Records ({availableRecords.length})
              </button>
            </div>
          </div>

          {/* Duration Selector */}
          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', color: '#94a3b8', marginBottom: '0.35rem', fontWeight: 500 }}>
              Evaluation Duration
            </label>
            <div style={{ display: 'flex', gap: '0.35rem' }}>
              {[
                { label: '10s Preview', val: 10 },
                { label: '60s Standard', val: 60 },
                { label: '300s (5m)', val: 300 },
                { label: 'Full Record', val: null },
              ].map((item) => (
                <button
                  key={String(item.val)}
                  type="button"
                  onClick={() => setDurationSec(item.val)}
                  style={{
                    flex: 1,
                    padding: '0.45rem 0.4rem',
                    fontSize: '0.75rem',
                    borderRadius: '6px',
                    border: durationSec === item.val ? '1px solid #10b981' : '1px solid rgba(51, 65, 85, 0.6)',
                    background: durationSec === item.val ? 'rgba(16, 185, 129, 0.15)' : 'rgba(15, 23, 42, 0.6)',
                    color: durationSec === item.val ? '#10b981' : '#94a3b8',
                    cursor: 'pointer',
                    fontWeight: 500,
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* Matching Tolerance Slider & Input */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
              <label style={{ fontSize: '0.78rem', color: '#94a3b8', fontWeight: 500 }}>
                Matching Tolerance (ANSI/AAMI EC57)
              </label>
              <span style={{ fontSize: '0.78rem', color: '#38bdf8', fontWeight: 600 }}>
                ±{toleranceMs} ms (±{Math.round((toleranceMs / 1000) * 360)} samples)
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <input
                type="range"
                min="20"
                max="300"
                step="5"
                value={toleranceMs}
                onChange={(e) => setToleranceMs(Number(e.target.value))}
                style={{ flex: 1, accentColor: '#38bdf8', cursor: 'pointer' }}
              />
              <input
                type="number"
                min="20"
                max="300"
                step="5"
                value={toleranceMs}
                onChange={(e) => setToleranceMs(Number(e.target.value))}
                style={{
                  width: '60px',
                  padding: '0.35rem 0.45rem',
                  fontSize: '0.78rem',
                  background: 'rgba(15, 23, 42, 0.8)',
                  border: '1px solid rgba(51, 65, 85, 0.8)',
                  borderRadius: '6px',
                  color: '#f8fafc',
                  textAlign: 'center',
                }}
              />
            </div>
          </div>
        </div>

        {/* Custom Record Selection Pills (visible when scope === 'custom') */}
        {scope === 'custom' && (
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '0.35rem',
              paddingTop: '0.65rem',
              borderTop: '1px dashed rgba(51, 65, 85, 0.4)',
            }}
          >
            <span style={{ fontSize: '0.75rem', color: '#94a3b8', alignSelf: 'center', marginRight: '0.35rem' }}>
              Select Records:
            </span>
            {availableRecords.map((rId) => {
              const isSelected = selectedRecords.includes(rId);
              return (
                <button
                  key={rId}
                  type="button"
                  onClick={() => {
                    if (isSelected) {
                      if (selectedRecords.length > 1) {
                        setSelectedRecords(selectedRecords.filter((id) => id !== rId));
                      }
                    } else {
                      setSelectedRecords([...selectedRecords, rId]);
                    }
                  }}
                  style={{
                    padding: '0.25rem 0.6rem',
                    fontSize: '0.75rem',
                    borderRadius: '4px',
                    border: isSelected ? '1px solid #38bdf8' : '1px solid rgba(51, 65, 85, 0.6)',
                    background: isSelected ? 'rgba(56, 189, 248, 0.2)' : 'rgba(15, 23, 42, 0.5)',
                    color: isSelected ? '#38bdf8' : '#64748b',
                    cursor: 'pointer',
                    fontWeight: isSelected ? 600 : 400,
                  }}
                >
                  {rId}
                </button>
              );
            })}
          </div>
        )}

        {error && (
          <div
            style={{
              padding: '0.65rem 0.85rem',
              borderRadius: '6px',
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid #ef4444',
              color: '#fca5a5',
              fontSize: '0.8rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <AlertTriangle size={16} />
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* ───────────────────────── Side-by-Side Comparison Section ───────────────────────── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))',
          gap: '1.25rem',
        }}
      >
        {/* Card 1: Historical Published Paper Reference */}
        <div
          className="card"
          style={{
            background: 'rgba(15, 23, 42, 0.75)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(100, 116, 139, 0.4)',
            borderRadius: '12px',
            padding: '1.2rem',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: '0.85rem',
          }}
        >
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.45rem' }}>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase',
                  padding: '0.2rem 0.55rem',
                  borderRadius: '4px',
                  background: 'rgba(148, 163, 184, 0.15)',
                  color: '#94a3b8',
                  border: '1px solid rgba(148, 163, 184, 0.3)',
                }}
              >
                <Database size={13} />
                HISTORICAL LITERATURE RESULT — PAN &amp; TOMPKINS (1985)
              </span>
              <span style={{ fontSize: '0.72rem', color: '#64748b' }}>IEEE BME-32(3)</span>
            </div>

            <h3 style={{ margin: '0.35rem 0 0.2rem 0', fontSize: '1.05rem', color: '#e2e8f0', fontWeight: 600 }}>
              Original Published Benchmark
            </h3>
            <p style={{ margin: 0, fontSize: '0.76rem', color: '#94a3b8' }}>
              {paperRef?.dataset || 'MIT-BIH Arrhythmia Database (all 48 24-hr analog tape recordings)'}
            </p>
          </div>

          {/* Historical Metrics Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '0.65rem',
              padding: '0.75rem 0.85rem',
              background: 'rgba(15, 23, 42, 0.6)',
              borderRadius: '8px',
              border: '1px solid rgba(51, 65, 85, 0.5)',
            }}
          >
            <div>
              <span style={{ display: 'block', fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase' }}>
                Sensitivity (Se)
              </span>
              <span style={{ fontSize: '1.4rem', fontWeight: 700, color: '#e2e8f0' }}>
                {paperRef?.sensitivity_percent?.toFixed(2) ?? '99.30'}%
              </span>
              <span style={{ display: 'block', fontSize: '0.68rem', color: '#64748b' }}>
                Quoted in Abstract
              </span>
            </div>

            <div>
              <span style={{ display: 'block', fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase' }}>
                Failure Rate
              </span>
              <span style={{ fontSize: '1.4rem', fontWeight: 700, color: '#e2e8f0' }}>
                {paperRef?.failure_rate_percent?.toFixed(3) ?? '0.675'}%
              </span>
              <span style={{ display: 'block', fontSize: '0.68rem', color: '#64748b' }}>
                (FP + FN) / Total Beats
              </span>
            </div>

            <div>
              <span style={{ display: 'block', fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase' }}>
                Published PPV
              </span>
              <span style={{ fontSize: '1.4rem', fontWeight: 700, color: '#e2e8f0' }}>
                {paperRef?.ppv_percent?.toFixed(2) ?? '99.56'}%
              </span>
              <span style={{ display: 'block', fontSize: '0.65rem', color: '#fbbf24' }}>
                *Derived from counts
              </span>
            </div>
          </div>

          {/* Published Beat Counts */}
          <div style={{ fontSize: '0.75rem', color: '#94a3b8', lineHeight: 1.4 }}>
            <div>
              <strong>Published Event Counts:</strong> {paperRef?.total_beats?.toLocaleString() ?? '116,137'} Total Beats •{' '}
              <span style={{ color: '#f87171' }}>{paperRef?.false_positives ?? '507'} FP</span> •{' '}
              <span style={{ color: '#f87171' }}>{paperRef?.false_negatives ?? '277'} FN</span>
            </div>
            <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '0.2rem' }}>
              *Note: {paperRef?.ppv_label || 'Published PPV (derived from paper\'s reported FP/FN counts)'}: {paperRef?.ppv_derivation_formula}
            </div>
          </div>

          {/* Mandatory Methodological Difference Disclaimer */}
          <div
            style={{
              padding: '0.65rem 0.8rem',
              borderRadius: '6px',
              background: 'rgba(51, 65, 85, 0.25)',
              border: '1px solid rgba(71, 85, 105, 0.4)',
              fontSize: '0.72rem',
              color: '#94a3b8',
              lineHeight: 1.35,
            }}
          >
            <strong>Methodological Notice:</strong> {paperRef?.disclaimer ||
              'Historical Pan–Tompkins benchmark and this implementation are not necessarily directly comparable because implementation details, sampling rate, filtering, evaluated records, evaluation duration, annotation handling, and matching configuration may differ.'}
          </div>
        </div>

        {/* Card 2: Live Implementation Benchmark Result */}
        <div
          className="card"
          style={{
            background: 'rgba(15, 23, 42, 0.75)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(16, 185, 129, 0.45)',
            borderRadius: '12px',
            padding: '1.2rem',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: '0.85rem',
            boxShadow: '0 4px 20px rgba(16, 185, 129, 0.1)',
          }}
        >
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.45rem' }}>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase',
                  padding: '0.2rem 0.55rem',
                  borderRadius: '4px',
                  background: 'rgba(16, 185, 129, 0.2)',
                  color: '#34d399',
                  border: '1px solid rgba(16, 185, 129, 0.4)',
                }}
              >
                <ShieldCheck size={13} />
                OUR IMPLEMENTATION — LIVE BENCHMARK
              </span>
              <span style={{ fontSize: '0.72rem', color: '#10b981', fontWeight: 600 }}>
                {benchmarkResult?.records?.length || 1} Record(s) Evaluated
              </span>
            </div>

            <h3 style={{ margin: '0.35rem 0 0.2rem 0', fontSize: '1.05rem', color: '#f8fafc', fontWeight: 600 }}>
              Live Benchmark Result (Deterministic Bipartite Matching)
            </h3>
            <p style={{ margin: 0, fontSize: '0.76rem', color: '#94a3b8' }}>
              Tolerance: ±{toleranceMs} ms • Duration:{' '}
              {durationSec ? `${durationSec}s` : 'Full Record'} • Window: {detectorParams.windowSizeMs} ms
            </p>
          </div>

          {/* Live Metrics Grid (Micro Aggregate / Single Record) */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '0.55rem',
              padding: '0.75rem 0.85rem',
              background: 'rgba(15, 23, 42, 0.6)',
              borderRadius: '8px',
              border: '1px solid rgba(16, 185, 129, 0.3)',
            }}
          >
            <div>
              <span style={{ display: 'block', fontSize: '0.68rem', color: '#94a3b8', textTransform: 'uppercase' }}>
                Sensitivity (Se)
              </span>
              <span style={{ fontSize: '1.35rem', fontWeight: 700, color: '#34d399' }}>
                {summary?.micro ? `${summary.micro.sensitivity_percent}%` : '--'}
              </span>
              <span style={{ display: 'block', fontSize: '0.65rem', color: '#64748b' }}>
                TP / (TP + FN)
              </span>
            </div>

            <div>
              <span style={{ display: 'block', fontSize: '0.68rem', color: '#94a3b8', textTransform: 'uppercase' }}>
                PPV (Precision)
              </span>
              <span style={{ fontSize: '1.35rem', fontWeight: 700, color: '#38bdf8' }}>
                {summary?.micro ? `${summary.micro.ppv_percent}%` : '--'}
              </span>
              <span style={{ display: 'block', fontSize: '0.65rem', color: '#64748b' }}>
                TP / (TP + FP)
              </span>
            </div>

            <div>
              <span style={{ display: 'block', fontSize: '0.68rem', color: '#94a3b8', textTransform: 'uppercase' }}>
                Error Rate (DER)
              </span>
              <span
                style={{
                  fontSize: '1.35rem',
                  fontWeight: 700,
                  color: summary?.micro?.der_percent > 2 ? '#f87171' : '#e2e8f0',
                }}
              >
                {summary?.micro ? `${summary.micro.der_percent}%` : '--'}
              </span>
              <span style={{ display: 'block', fontSize: '0.65rem', color: '#64748b' }}>
                (FP + FN) / Ref
              </span>
            </div>

            <div>
              <span style={{ display: 'block', fontSize: '0.68rem', color: '#94a3b8', textTransform: 'uppercase' }}>
                Event Accuracy
              </span>
              <span style={{ fontSize: '1.35rem', fontWeight: 700, color: '#c084fc' }}>
                {summary?.micro ? `${summary.micro.event_accuracy_percent}%` : '--'}
              </span>
              <span style={{ display: 'block', fontSize: '0.65rem', color: '#64748b' }}>
                TP / (TP+FP+FN)
              </span>
            </div>
          </div>

          {/* Counts and Timing Latency Stats */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '0.65rem',
              fontSize: '0.74rem',
              color: '#94a3b8',
            }}
          >
            <div>
              <strong style={{ color: '#e2e8f0', display: 'block', marginBottom: '0.2rem' }}>
                Event Classification Counts:
              </strong>
              <div>
                True Positives (TP): <span style={{ color: '#34d399', fontWeight: 600 }}>{summary?.micro?.tp ?? '--'}</span>
              </div>
              <div>
                False Positives (FP): <span style={{ color: '#f59e0b', fontWeight: 600 }}>{summary?.micro?.fp ?? '--'}</span>
              </div>
              <div>
                False Negatives (FN): <span style={{ color: '#f87171', fontWeight: 600 }}>{summary?.micro?.fn ?? '--'}</span>
              </div>
              <div>
                Total Reference Beats: <span style={{ color: '#e2e8f0' }}>{summary?.micro?.total_reference_beats ?? '--'}</span>
              </div>
            </div>

            <div>
              <strong style={{ color: '#e2e8f0', display: 'block', marginBottom: '0.2rem' }}>
                Timing Latency Distribution:
              </strong>
              <div>
                Mean Absolute Latency: <span style={{ color: '#38bdf8' }}>{summary?.latency?.mean_ms ?? '--'} ms</span>
              </div>
              <div>
                Median Latency: <span style={{ color: '#38bdf8' }}>{summary?.latency?.median_ms ?? '--'} ms</span>
              </div>
              <div>
                Maximum Latency: <span style={{ color: '#38bdf8' }}>{summary?.latency?.max_ms ?? '--'} ms</span>
              </div>
              <div>
                Timing Jitter (Std Dev): <span style={{ color: '#c084fc' }}>±{summary?.latency?.std_ms ?? '--'} ms</span>
              </div>
            </div>
          </div>

          {/* Educational provenance notice on QRS delineation distinction */}
          <div
            style={{
              padding: '0.65rem 0.8rem',
              borderRadius: '6px',
              background: 'rgba(56, 189, 248, 0.1)',
              border: '1px solid rgba(56, 189, 248, 0.3)',
              fontSize: '0.71rem',
              color: '#93c5fd',
              lineHeight: 1.35,
            }}
          >
            <strong>Note on QRS Delineation:</strong> This benchmark evaluates QRS complex detection and fiducial timing against MIT-BIH reference annotations under ANSI/AAMI EC57 (±150 ms tolerance). It does NOT validate individual Q, R, or S morphological landmark localization accuracy, which requires dedicated tight tolerances and specialized delineation datasets.
          </div>
        </div>
      </div>

      {/* ───────────────────────── Interactive Waveform Visualization ───────────────────────── */}
      <div
        className="card"
        style={{
          background: 'rgba(15, 23, 42, 0.75)',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(51, 65, 85, 0.45)',
          borderRadius: '12px',
          padding: '1.2rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.85rem',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1rem', color: '#f8fafc', fontWeight: 600 }}>
              Benchmark ECG Waveform &amp; Event Overlays
            </h3>
            <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.76rem', color: '#94a3b8' }}>
              Showing {inspectedRecord?.visualization?.snippet_duration_sec ?? 10}s snippet for Record{' '}
              <strong style={{ color: '#38bdf8' }}>{inspectedRecordId}</strong>.
            </p>
          </div>

          {/* Multi-record inspection selector if more than 1 record */}
          {benchmarkResult?.records && benchmarkResult.records.length > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
              <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>Inspect Record:</span>
              <select
                value={inspectedRecordId}
                onChange={(e) => setInspectedRecordId(e.target.value)}
                style={{
                  padding: '0.35rem 0.75rem',
                  fontSize: '0.78rem',
                  background: 'rgba(15, 23, 42, 0.8)',
                  border: '1px solid rgba(51, 65, 85, 0.8)',
                  borderRadius: '6px',
                  color: '#38bdf8',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {benchmarkResult.records.map((r) => (
                  <option key={r.record_id} value={r.record_id}>
                    Record {r.record_id} (Se: {r.metrics.sensitivity_percent}%, PPV: {r.metrics.ppv_percent}%)
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Diagnostic Overlay Legend */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: '1.1rem',
            padding: '0.6rem 0.85rem',
            background: 'rgba(15, 23, 42, 0.5)',
            border: '1px solid rgba(51, 65, 85, 0.4)',
            borderRadius: '6px',
            fontSize: '0.75rem',
            color: '#94a3b8',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', border: '2px solid #38bdf8', display: 'inline-block' }} />
            <span><strong>Ground Truth Reference Beat</strong> (cyan hollow circle + symbol)</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
            <span><strong>Matched True Positive (TP)</strong> (green circle)</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <span style={{ width: 0, height: 0, borderLeft: '5px solid transparent', borderRight: '5px solid transparent', borderBottom: '9px solid #f59e0b', display: 'inline-block' }} />
            <span><strong>False Positive (FP)</strong> (amber triangle)</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <span style={{ width: 0, height: 0, borderLeft: '5px solid transparent', borderRight: '5px solid transparent', borderTop: '9px solid #ef4444', display: 'inline-block' }} />
            <span><strong>False Negative (FN)</strong> (red inverted triangle)</span>
          </div>
        </div>

        {/* Plotly Chart */}
        <div style={{ width: '100%', height: '340px', borderRadius: '8px', overflow: 'hidden' }}>
          {plotData.length > 0 ? (
            <Plot
              data={plotData}
              layout={{
                autosize: true,
                margin: { l: 45, r: 25, t: 25, b: 40 },
                paper_bgcolor: 'transparent',
                plot_bgcolor: 'rgba(15, 23, 42, 0.4)',
                xaxis: {
                  title: { text: 'Time (seconds)', font: { color: '#94a3b8', size: 11 } },
                  tickfont: { color: '#64748b', size: 10 },
                  gridcolor: 'rgba(51, 65, 85, 0.25)',
                  zerolinecolor: 'rgba(51, 65, 85, 0.4)',
                },
                yaxis: {
                  title: { text: 'Amplitude (mV)', font: { color: '#94a3b8', size: 11 } },
                  tickfont: { color: '#64748b', size: 10 },
                  gridcolor: 'rgba(51, 65, 85, 0.25)',
                  zerolinecolor: 'rgba(51, 65, 85, 0.4)',
                },
                showlegend: true,
                legend: {
                  x: 0,
                  y: 1.12,
                  orientation: 'h',
                  font: { color: '#cbd5e1', size: 10 },
                  bgcolor: 'rgba(15, 23, 42, 0.7)',
                },
                hovermode: 'closest',
              }}
              config={{ responsive: true, displayModeBar: false }}
              style={{ width: '100%', height: '100%' }}
            />
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#64748b' }}>
              No waveform data available. Click "Run Benchmark" to evaluate.
            </div>
          )}
        </div>
      </div>

      {/* ───────────────────────── Event Classification Audit Log ───────────────────────── */}
      <div
        className="card"
        style={{
          background: 'rgba(15, 23, 42, 0.75)',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(51, 65, 85, 0.45)',
          borderRadius: '12px',
          padding: '1.2rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.85rem',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.65rem' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1rem', color: '#f8fafc', fontWeight: 600 }}>
              Event-Level Classification Audit Log
            </h3>
            <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.76rem', color: '#94a3b8' }}>
              Auditable log of all reference annotations, detected peaks, matching latencies, and decisions for Record{' '}
              <strong style={{ color: '#38bdf8' }}>{inspectedRecordId}</strong>.
            </p>
          </div>

          {/* Classification Filter Chips */}
          <div style={{ display: 'flex', gap: '0.35rem' }}>
            {[
              { id: 'ALL', label: `All Events (${inspectedRecord?.events_audit?.length || 0})` },
              { id: 'TP', label: `TP: Matched (${inspectedRecord?.metrics?.tp || 0})`, color: '#10b981' },
              { id: 'FP', label: `FP: Extra (${inspectedRecord?.metrics?.fp || 0})`, color: '#f59e0b' },
              { id: 'FN', label: `FN: Missed (${inspectedRecord?.metrics?.fn || 0})`, color: '#ef4444' },
            ].map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setEventFilter(f.id)}
                style={{
                  padding: '0.3rem 0.65rem',
                  fontSize: '0.72rem',
                  borderRadius: '4px',
                  border: eventFilter === f.id ? `1px solid ${f.color || '#38bdf8'}` : '1px solid rgba(51, 65, 85, 0.6)',
                  background: eventFilter === f.id ? 'rgba(56, 189, 248, 0.15)' : 'rgba(15, 23, 42, 0.6)',
                  color: eventFilter === f.id ? f.color || '#38bdf8' : '#94a3b8',
                  fontWeight: eventFilter === f.id ? 600 : 400,
                  cursor: 'pointer',
                }}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Scrollable Audit Table */}
        <div style={{ maxHeight: '280px', overflowY: 'auto', border: '1px solid rgba(51, 65, 85, 0.4)', borderRadius: '6px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem', textAlign: 'left' }}>
            <thead style={{ position: 'sticky', top: 0, background: '#0f172a', zIndex: 10 }}>
              <tr style={{ borderBottom: '1px solid rgba(51, 65, 85, 0.6)', color: '#94a3b8' }}>
                <th style={{ padding: '0.5rem 0.75rem' }}>Classification</th>
                <th style={{ padding: '0.5rem 0.75rem' }}>Time (s)</th>
                <th style={{ padding: '0.5rem 0.75rem' }}>Reference Sample</th>
                <th style={{ padding: '0.5rem 0.75rem' }}>Annotation Symbol</th>
                <th style={{ padding: '0.5rem 0.75rem' }}>Detected Sample</th>
                <th style={{ padding: '0.5rem 0.75rem' }}>Timing Error (Δt)</th>
                <th style={{ padding: '0.5rem 0.75rem' }}>Description</th>
              </tr>
            </thead>
            <tbody>
              {filteredEvents.length > 0 ? (
                filteredEvents.map((ev, idx) => {
                  let badgeBg = 'rgba(16, 185, 129, 0.15)';
                  let badgeBorder = '#10b981';
                  let badgeColor = '#34d399';
                  let desc = 'Matched within tolerance';

                  if (ev.classification === 'FP') {
                    badgeBg = 'rgba(245, 158, 11, 0.15)';
                    badgeBorder = '#f59e0b';
                    badgeColor = '#fbbf24';
                    desc = 'False Positive: detector triggered without reference beat';
                  } else if (ev.classification === 'FN') {
                    badgeBg = 'rgba(239, 68, 68, 0.15)';
                    badgeBorder = '#ef4444';
                    badgeColor = '#f87171';
                    desc = 'False Negative: ground truth beat missed by detector';
                  }

                  return (
                    <tr
                      key={ev.event_id || idx}
                      style={{
                        borderBottom: '1px solid rgba(51, 65, 85, 0.25)',
                        background: idx % 2 === 0 ? 'rgba(15, 23, 42, 0.3)' : 'transparent',
                      }}
                    >
                      <td style={{ padding: '0.45rem 0.75rem' }}>
                        <span
                          style={{
                            padding: '0.15rem 0.45rem',
                            borderRadius: '3px',
                            background: badgeBg,
                            border: `1px solid ${badgeBorder}`,
                            color: badgeColor,
                            fontWeight: 600,
                            fontSize: '0.7rem',
                          }}
                        >
                          {ev.classification}
                        </span>
                      </td>
                      <td style={{ padding: '0.45rem 0.75rem', color: '#e2e8f0', fontFamily: 'monospace' }}>
                        {ev.time_sec?.toFixed(3)}s
                      </td>
                      <td style={{ padding: '0.45rem 0.75rem', color: '#94a3b8', fontFamily: 'monospace' }}>
                        {ev.reference_sample !== null ? ev.reference_sample : '--'}
                      </td>
                      <td style={{ padding: '0.45rem 0.75rem' }}>
                        {ev.symbol ? (
                          <span
                            style={{
                              padding: '0.1rem 0.4rem',
                              borderRadius: '3px',
                              background: 'rgba(56, 189, 248, 0.15)',
                              color: '#38bdf8',
                              fontWeight: 600,
                              fontFamily: 'monospace',
                            }}
                          >
                            {ev.symbol}
                          </span>
                        ) : (
                          '--'
                        )}
                      </td>
                      <td style={{ padding: '0.45rem 0.75rem', color: '#94a3b8', fontFamily: 'monospace' }}>
                        {ev.detected_sample !== null ? ev.detected_sample : '--'}
                      </td>
                      <td style={{ padding: '0.45rem 0.75rem', fontFamily: 'monospace' }}>
                        {ev.delta_ms !== null ? (
                          <span style={{ color: Math.abs(ev.delta_ms) > 30 ? '#fbbf24' : '#34d399' }}>
                            {ev.delta_ms > 0 ? `+${ev.delta_ms}` : ev.delta_ms} ms
                          </span>
                        ) : (
                          '--'
                        )}
                      </td>
                      <td style={{ padding: '0.45rem 0.75rem', color: '#64748b' }}>{desc}</td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} style={{ padding: '1.5rem', textAlign: 'center', color: '#64748b' }}>
                    No events match the selected filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ───────────────────────── Multi-Record Performance Breakdown Table ───────────────────────── */}
      {benchmarkResult?.records && benchmarkResult.records.length > 1 && (
        <div
          className="card"
          style={{
            background: 'rgba(15, 23, 42, 0.75)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(51, 65, 85, 0.45)',
            borderRadius: '12px',
            padding: '1.2rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.85rem',
          }}
        >
          <div>
            <h3 style={{ margin: 0, fontSize: '1rem', color: '#f8fafc', fontWeight: 600 }}>
              Per-Record Performance Breakdown &amp; Aggregates
            </h3>
            <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.76rem', color: '#94a3b8' }}>
              Micro metrics (global summed events) and Macro metrics (unweighted record averages) across all evaluated records.
            </p>
          </div>

          <div style={{ overflowX: 'auto', border: '1px solid rgba(51, 65, 85, 0.4)', borderRadius: '6px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem', textAlign: 'left' }}>
              <thead style={{ background: '#0f172a' }}>
                <tr style={{ borderBottom: '1px solid rgba(51, 65, 85, 0.6)', color: '#94a3b8' }}>
                  <th style={{ padding: '0.55rem 0.75rem' }}>Record</th>
                  <th style={{ padding: '0.55rem 0.75rem' }}>Duration</th>
                  <th style={{ padding: '0.55rem 0.75rem' }}>Ref Beats</th>
                  <th style={{ padding: '0.55rem 0.75rem' }}>Detected</th>
                  <th style={{ padding: '0.55rem 0.75rem', color: '#34d399' }}>TP</th>
                  <th style={{ padding: '0.55rem 0.75rem', color: '#f59e0b' }}>FP</th>
                  <th style={{ padding: '0.55rem 0.75rem', color: '#f87171' }}>FN</th>
                  <th style={{ padding: '0.55rem 0.75rem', color: '#34d399' }}>Sensitivity (Se)</th>
                  <th style={{ padding: '0.55rem 0.75rem', color: '#38bdf8' }}>PPV</th>
                  <th style={{ padding: '0.55rem 0.75rem' }}>Error (DER)</th>
                  <th style={{ padding: '0.55rem 0.75rem' }}>Mean Latency</th>
                  <th style={{ padding: '0.55rem 0.75rem' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {benchmarkResult.records.map((r, idx) => {
                  const m = r.metrics;
                  const isCurrentInspected = r.record_id === inspectedRecordId;
                  return (
                    <tr
                      key={r.record_id}
                      style={{
                        borderBottom: '1px solid rgba(51, 65, 85, 0.25)',
                        background: isCurrentInspected
                          ? 'rgba(56, 189, 248, 0.1)'
                          : idx % 2 === 0
                          ? 'rgba(15, 23, 42, 0.3)'
                          : 'transparent',
                      }}
                    >
                      <td style={{ padding: '0.5rem 0.75rem', fontWeight: 600, color: '#38bdf8' }}>
                        Record {r.record_id}
                      </td>
                      <td style={{ padding: '0.5rem 0.75rem', color: '#94a3b8' }}>
                        {r.duration_sec}s
                      </td>
                      <td style={{ padding: '0.5rem 0.75rem', color: '#e2e8f0' }}>
                        {m.total_reference_beats}
                      </td>
                      <td style={{ padding: '0.5rem 0.75rem', color: '#e2e8f0' }}>
                        {m.total_detected_beats}
                      </td>
                      <td style={{ padding: '0.5rem 0.75rem', color: '#34d399', fontWeight: 600 }}>
                        {m.tp}
                      </td>
                      <td style={{ padding: '0.5rem 0.75rem', color: '#f59e0b', fontWeight: 600 }}>
                        {m.fp}
                      </td>
                      <td style={{ padding: '0.5rem 0.75rem', color: '#f87171', fontWeight: 600 }}>
                        {m.fn}
                      </td>
                      <td style={{ padding: '0.5rem 0.75rem', color: '#34d399', fontWeight: 600 }}>
                        {m.sensitivity_percent}%
                      </td>
                      <td style={{ padding: '0.5rem 0.75rem', color: '#38bdf8', fontWeight: 600 }}>
                        {m.ppv_percent}%
                      </td>
                      <td style={{ padding: '0.5rem 0.75rem', color: m.der_percent > 2 ? '#f87171' : '#e2e8f0' }}>
                        {m.der_percent}%
                      </td>
                      <td style={{ padding: '0.5rem 0.75rem', color: '#94a3b8' }}>
                        {r.latency.mean_ms} ± {r.latency.std_ms} ms
                      </td>
                      <td style={{ padding: '0.5rem 0.75rem' }}>
                        <button
                          type="button"
                          onClick={() => setInspectedRecordId(r.record_id)}
                          style={{
                            padding: '0.25rem 0.55rem',
                            fontSize: '0.7rem',
                            borderRadius: '4px',
                            border: isCurrentInspected ? '1px solid #38bdf8' : '1px solid rgba(51, 65, 85, 0.6)',
                            background: isCurrentInspected ? 'rgba(56, 189, 248, 0.2)' : 'rgba(15, 23, 42, 0.6)',
                            color: isCurrentInspected ? '#38bdf8' : '#cbd5e1',
                            cursor: 'pointer',
                          }}
                        >
                          {isCurrentInspected ? 'Viewing' : 'Inspect'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {/* Summary Rows (Micro and Macro) */}
              <tfoot style={{ background: '#090d16', borderTop: '2px solid rgba(51, 65, 85, 0.8)' }}>
                {/* Micro Aggregate Row */}
                <tr style={{ fontWeight: 600, color: '#f8fafc' }}>
                  <td style={{ padding: '0.6rem 0.75rem', color: '#34d399' }}>
                    MICRO TOTAL
                  </td>
                  <td style={{ padding: '0.6rem 0.75rem', color: '#94a3b8' }}>Summed</td>
                  <td style={{ padding: '0.6rem 0.75rem' }}>{summary?.micro?.total_reference_beats}</td>
                  <td style={{ padding: '0.6rem 0.75rem' }}>{summary?.micro?.total_detected_beats}</td>
                  <td style={{ padding: '0.6rem 0.75rem', color: '#34d399' }}>{summary?.micro?.tp}</td>
                  <td style={{ padding: '0.6rem 0.75rem', color: '#f59e0b' }}>{summary?.micro?.fp}</td>
                  <td style={{ padding: '0.6rem 0.75rem', color: '#f87171' }}>{summary?.micro?.fn}</td>
                  <td style={{ padding: '0.6rem 0.75rem', color: '#34d399' }}>
                    {summary?.micro?.sensitivity_percent}%
                  </td>
                  <td style={{ padding: '0.6rem 0.75rem', color: '#38bdf8' }}>
                    {summary?.micro?.ppv_percent}%
                  </td>
                  <td style={{ padding: '0.6rem 0.75rem' }}>
                    {summary?.micro?.der_percent}%
                  </td>
                  <td style={{ padding: '0.6rem 0.75rem', color: '#38bdf8' }}>
                    {summary?.latency?.mean_ms} ms
                  </td>
                  <td style={{ padding: '0.6rem 0.75rem', color: '#64748b' }}>Global Sum</td>
                </tr>

                {/* Macro Average Row */}
                <tr style={{ color: '#cbd5e1', fontSize: '0.73rem', borderTop: '1px solid rgba(51, 65, 85, 0.4)' }}>
                  <td style={{ padding: '0.5rem 0.75rem', color: '#a78bfa', fontWeight: 600 }}>
                    MACRO AVERAGE
                  </td>
                  <td style={{ padding: '0.5rem 0.75rem', color: '#64748b' }}>Unweighted Mean</td>
                  <td style={{ padding: '0.5rem 0.75rem', color: '#64748b' }}>--</td>
                  <td style={{ padding: '0.5rem 0.75rem', color: '#64748b' }}>--</td>
                  <td style={{ padding: '0.5rem 0.75rem', color: '#64748b' }}>--</td>
                  <td style={{ padding: '0.5rem 0.75rem', color: '#64748b' }}>--</td>
                  <td style={{ padding: '0.5rem 0.75rem', color: '#64748b' }}>--</td>
                  <td style={{ padding: '0.5rem 0.75rem', color: '#34d399', fontWeight: 600 }}>
                    {summary?.macro?.sensitivity_percent}%
                  </td>
                  <td style={{ padding: '0.5rem 0.75rem', color: '#38bdf8', fontWeight: 600 }}>
                    {summary?.macro?.ppv_percent}%
                  </td>
                  <td style={{ padding: '0.5rem 0.75rem' }}>
                    {summary?.macro?.der_percent}%
                  </td>
                  <td style={{ padding: '0.5rem 0.75rem', color: '#64748b' }}>--</td>
                  <td style={{ padding: '0.5rem 0.75rem', color: '#64748b' }}>Mean of Records</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

import React, { useState, useLayoutEffect, useEffect } from 'react';

/**
 * PlaybackCursor dynamically aligns a vertical playback indicator over the Plotly ECG canvas.
 * It measures Plotly's internal `.plotbg` rect to guarantee exact sub-pixel coordinate alignment
 * without hard-coded pixel margins, preventing cursor drift across zoom levels, window resizes,
 * and different y-axis tick widths.
 */
export default function PlaybackCursor({ currentTime, xRange, containerRef }) {
  const [plotBounds, setPlotBounds] = useState({
    left: 58,
    width: 0,
    top: 18,
    height: 0,
  });

  // Measure actual Plotly plot area from the DOM
  const updateBounds = () => {
    if (!containerRef?.current) return;
    const plotBg = containerRef.current.querySelector('.plotbg');
    if (plotBg) {
      const x = parseFloat(plotBg.getAttribute('x'));
      const w = parseFloat(plotBg.getAttribute('width'));
      const y = parseFloat(plotBg.getAttribute('y'));
      const h = parseFloat(plotBg.getAttribute('height'));

      if (!isNaN(x) && !isNaN(w) && w > 0) {
        setPlotBounds({
          left: x,
          width: w,
          top: !isNaN(y) ? y : 18,
          height: !isNaN(h) ? h : containerRef.current.clientHeight - 70,
        });
        return;
      }
    }

    // Fallback: estimate from container clientWidth if .plotbg not yet rendered
    if (containerRef.current.clientWidth > 0) {
      setPlotBounds((prev) => ({
        ...prev,
        width: Math.max(0, containerRef.current.clientWidth - 76),
        height: Math.max(0, containerRef.current.clientHeight - 70),
      }));
    }
  };

  // Measure on layout and observe container size changes
  useLayoutEffect(() => {
    updateBounds();
  }, [containerRef]);

  useEffect(() => {
    if (!containerRef?.current) return;
    const el = containerRef.current;

    // MutationObserver to detect when Plotly finishes rendering .plotbg
    const mo = new MutationObserver(() => {
      updateBounds();
    });
    mo.observe(el, { childList: true, subtree: true, attributes: true });

    // ResizeObserver to detect container dimensions changing
    const ro = new ResizeObserver(() => {
      updateBounds();
    });
    ro.observe(el);

    return () => {
      mo.disconnect();
      ro.disconnect();
    };
  }, [containerRef]);

  const [xMin, xMax] = xRange || [0, 10];
  const inView = currentTime >= xMin && currentTime <= xMax;

  if (!inView || xMax <= xMin || plotBounds.width <= 0) {
    return null;
  }

  const pct = (currentTime - xMin) / (xMax - xMin);
  const cursorPixelX = plotBounds.left + plotBounds.width * pct;

  return (
    <div
      style={{
        position: 'absolute',
        top: plotBounds.top,
        height: plotBounds.height,
        left: cursorPixelX,
        width: 2,
        backgroundColor: '#ef4444',
        zIndex: 10,
        boxShadow: '0 0 10px rgba(239, 68, 68, 0.85)',
        pointerEvents: 'none',
        transform: 'translateX(-1px)',
        transition: 'none',
      }}
    />
  );
}

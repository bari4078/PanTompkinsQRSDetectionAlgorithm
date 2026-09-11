import React, { Component, StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Dashboard ErrorBoundary caught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          background: '#0f172a',
          color: '#f8fafc',
          padding: '2.5rem',
          fontFamily: 'system-ui, sans-serif'
        }}>
          <div style={{
            maxWidth: 800,
            margin: '0 auto',
            background: '#1e293b',
            padding: '2rem',
            borderRadius: 16,
            border: '1px solid #ef4444',
            boxShadow: '0 10px 25px rgba(0,0,0,0.5)'
          }}>
            <h1 style={{ color: '#ef4444', fontSize: '1.4rem', margin: '0 0 1rem' }}>
              Pan-Tompkins Dashboard Error
            </h1>
            <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '1.2rem' }}>
              An unexpected render error occurred. Detailed error trace below:
            </p>
            <pre style={{
              background: '#0f172a',
              color: '#fca5a5',
              padding: '1rem',
              borderRadius: 8,
              fontSize: '0.85rem',
              overflowX: 'auto',
              border: '1px solid #334155'
            }}>
              {this.state.error?.stack || this.state.error?.toString()}
            </pre>
            <button
              type="button"
              onClick={() => window.location.reload()}
              style={{
                marginTop: '1.2rem',
                background: '#3b82f6',
                color: '#ffffff',
                border: 'none',
                borderRadius: 8,
                padding: '0.6rem 1.2rem',
                cursor: 'pointer',
                fontWeight: 600
              }}
            >
              Reload Application
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)

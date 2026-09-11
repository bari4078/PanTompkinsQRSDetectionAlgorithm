import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Search,
  Award,
  Clock,
  FileText,
  X,
  Sliders,
  Layers,
  Heart,
  Activity,
  ActivitySquare,
  AlertTriangle,
  Cpu,
} from 'lucide-react';
import { DOC_CHAPTERS, CATEGORIES, extractSections } from './docsRegistry';
import MarkdownContent from './MarkdownContent';

// Map icon strings to Lucide components
const ICON_MAP = {
  BookOpen,
  Heart,
  Cpu,
  Layers,
  Sliders,
  Activity,
  ActivitySquare,
  Award,
  AlertTriangle,
  FileText,
};

export default function DocumentationPanel({ onBack, onOpenEvaluation }) {
  const [activeChapterId, setActiveChapterId] = useState('introduction');
  const [searchQuery, setSearchQuery] = useState('');
  const contentContainerRef = useRef(null);

  // Active Chapter Object
  const activeChapter = useMemo(() => {
    return DOC_CHAPTERS.find((c) => c.id === activeChapterId) || DOC_CHAPTERS[0];
  }, [activeChapterId]);

  // Current chapter index
  const activeIndex = useMemo(() => {
    return DOC_CHAPTERS.findIndex((c) => c.id === activeChapter.id);
  }, [activeChapter.id]);

  // Extracted h2 sections for sub-navigation in the active chapter
  const activeSections = useMemo(() => {
    return extractSections(activeChapter.rawContent);
  }, [activeChapter.rawContent]);

  // Search Results
  const searchResults = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query || query.length < 2) return [];

    const results = [];
    DOC_CHAPTERS.forEach((ch) => {
      const titleMatch = ch.title.toLowerCase().includes(query);
      const subtitleMatch = ch.subtitle.toLowerCase().includes(query);

      // Find matching lines in markdown text
      const lines = ch.rawContent.split('\n');
      const matchingSnippets = [];

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (
          line.toLowerCase().includes(query) &&
          !line.startsWith('#') &&
          !line.startsWith('```') &&
          !line.startsWith('|')
        ) {
          matchingSnippets.push(line.slice(0, 140));
          if (matchingSnippets.length >= 2) break;
        }
      }

      if (titleMatch || subtitleMatch || matchingSnippets.length > 0) {
        results.push({
          chapter: ch,
          snippet: matchingSnippets[0] || ch.subtitle,
        });
      }
    });

    return results;
  }, [searchQuery]);

  // Scroll content to top whenever chapter changes
  useEffect(() => {
    if (contentContainerRef.current) {
      contentContainerRef.current.scrollTo({ top: 0, behavior: 'instant' });
    }
  }, [activeChapterId]);

  // Handle internal markdown links (e.g. "02_ecg_fundamentals.md")
  const handleNavigateChapter = (targetFile) => {
    const cleanName = targetFile.replace(/^\.\//, '').replace(/^docs\//, '');
    const found = DOC_CHAPTERS.find(
      (c) => c.file === cleanName || c.id === cleanName.replace('.md', '')
    );
    if (found) {
      setActiveChapterId(found.id);
      setSearchQuery('');
    }
  };

  // Smooth scroll to sub-section within the active chapter
  const scrollToSection = (sectionId) => {
    const el = document.getElementById(sectionId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: 'calc(100vh - 5rem)',
        background: '#0b1120',
        color: '#f8fafc',
        borderRadius: '12px',
        border: '1px solid #1e293b',
        overflow: 'hidden',
      }}
    >
      {/* ───────────────────────── Documentation Top Header ───────────────────────── */}
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.85rem 1.4rem',
          background: 'rgba(15, 23, 42, 0.95)',
          borderBottom: '1px solid #1e293b',
          gap: '1rem',
          flexWrap: 'wrap',
          position: 'sticky',
          top: 0,
          zIndex: 30,
          backdropFilter: 'blur(8px)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <button
            type="button"
            onClick={onBack}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.45rem 0.8rem',
              background: 'rgba(30, 41, 59, 0.8)',
              border: '1px solid #334155',
              borderRadius: '7px',
              color: '#38bdf8',
              fontSize: '0.84rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
            title="Return to the Interactive ECG Workspace"
          >
            <ChevronLeft size={16} />
            Back to Workspace
          </button>

          <div style={{ height: 20, width: 1, background: '#334155' }} />

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: '6px',
                background: 'linear-gradient(135deg, #0284c7, #38bdf8)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff',
              }}
            >
              <BookOpen size={16} />
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 700, color: '#f8fafc' }}>
                Pan-Tompkins Algorithm & Application Manual
              </h1>
              <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                Verified against repository code & original 1985 publication
              </span>
            </div>
          </div>
        </div>

        {/* Center Search Bar */}
        <div
          style={{
            position: 'relative',
            flex: '1 1 240px',
            maxWidth: 380,
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <Search
            size={15}
            style={{
              position: 'absolute',
              left: '0.75rem',
              color: '#64748b',
              pointerEvents: 'none',
            }}
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search documentation, formulas, or concepts..."
            style={{
              width: '100%',
              padding: '0.45rem 2rem 0.45rem 2.2rem',
              background: '#090e1a',
              border: '1px solid #334155',
              borderRadius: '7px',
              color: '#f8fafc',
              fontSize: '0.82rem',
              outline: 'none',
            }}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              style={{
                position: 'absolute',
                right: '0.6rem',
                background: 'transparent',
                border: 'none',
                color: '#94a3b8',
                cursor: 'pointer',
                padding: '0.2rem',
              }}
            >
              <X size={14} />
            </button>
          )}

          {/* Search Dropdown Overlay */}
          {searchResults.length > 0 && (
            <div
              style={{
                position: 'absolute',
                top: '115%',
                left: 0,
                right: 0,
                maxHeight: 320,
                overflowY: 'auto',
                background: '#0f172a',
                border: '1px solid #334155',
                borderRadius: '8px',
                boxShadow: '0 10px 25px rgba(0,0,0,0.6)',
                zIndex: 50,
                padding: '0.4rem',
              }}
            >
              <div
                style={{
                  fontSize: '0.7rem',
                  fontWeight: 600,
                  color: '#94a3b8',
                  padding: '0.35rem 0.6rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                Matching Chapters ({searchResults.length})
              </div>
              {searchResults.map(({ chapter, snippet }) => (
                <div
                  key={chapter.id}
                  onClick={() => {
                    setActiveChapterId(chapter.id);
                    setSearchQuery('');
                  }}
                  style={{
                    padding: '0.55rem 0.7rem',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    background:
                      chapter.id === activeChapter.id ? 'rgba(56, 189, 248, 0.12)' : 'transparent',
                    border:
                      chapter.id === activeChapter.id
                        ? '1px solid rgba(56, 189, 248, 0.3)'
                        : '1px solid transparent',
                    marginBottom: '0.25rem',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(51, 65, 85, 0.4)')}
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.background =
                      chapter.id === activeChapter.id ? 'rgba(56, 189, 248, 0.12)' : 'transparent')
                  }
                >
                  <div style={{ fontSize: '0.84rem', fontWeight: 600, color: '#38bdf8' }}>
                    {chapter.title}
                  </div>
                  <div
                    style={{
                      fontSize: '0.74rem',
                      color: '#94a3b8',
                      marginTop: '0.15rem',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {snippet}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Shortcuts */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          {onOpenEvaluation && (
            <button
              type="button"
              onClick={onOpenEvaluation}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.45rem 0.75rem',
                background: 'rgba(16, 185, 129, 0.12)',
                border: '1px solid rgba(16, 185, 129, 0.35)',
                borderRadius: '7px',
                color: '#34d399',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <Award size={14} />
              Evaluation Benchmark
            </button>
          )}

          <div
            style={{
              padding: '0.35rem 0.65rem',
              borderRadius: '6px',
              background: 'rgba(30, 41, 59, 0.6)',
              fontSize: '0.75rem',
              color: '#94a3b8',
              border: '1px solid #1e293b',
              whiteSpace: 'nowrap',
            }}
          >
            Chapter <strong style={{ color: '#38bdf8' }}>{activeIndex + 1}</strong> of{' '}
            {DOC_CHAPTERS.length}
          </div>
        </div>
      </header>

      {/* ───────────────────────── Documentation Two-Column Body ───────────────────────── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '290px minmax(0, 1fr)',
          flex: 1,
          minHeight: 0,
        }}
      >
        {/* ───────────────────────── Left Sidebar (Table of Contents) ───────────────────────── */}
        <aside
          style={{
            background: 'rgba(15, 23, 42, 0.75)',
            borderRight: '1px solid #1e293b',
            overflowY: 'auto',
            padding: '1rem 0.75rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.25rem',
            maxHeight: 'calc(100vh - 9rem)',
            position: 'sticky',
            top: '3.75rem',
          }}
        >
          {CATEGORIES.map((cat) => {
            const categoryChapters = DOC_CHAPTERS.filter((c) => c.category === cat);
            if (categoryChapters.length === 0) return null;

            return (
              <div key={cat}>
                <div
                  style={{
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    color: '#64748b',
                    letterSpacing: '0.08em',
                    padding: '0 0.5rem 0.4rem',
                  }}
                >
                  {cat}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                  {categoryChapters.map((ch) => {
                    const isActive = ch.id === activeChapter.id;
                    const IconComp = ICON_MAP[ch.iconName] || FileText;

                    return (
                      <div key={ch.id}>
                        <button
                          type="button"
                          onClick={() => {
                            setActiveChapterId(ch.id);
                            setSearchQuery('');
                          }}
                          style={{
                            width: '100%',
                            textAlign: 'left',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.6rem',
                            padding: '0.5rem 0.65rem',
                            borderRadius: '7px',
                            background: isActive ? 'rgba(56, 189, 248, 0.12)' : 'transparent',
                            border: isActive
                              ? '1px solid rgba(56, 189, 248, 0.4)'
                              : '1px solid transparent',
                            color: isActive ? '#38bdf8' : '#cbd5e1',
                            fontWeight: isActive ? 600 : 400,
                            fontSize: '0.84rem',
                            cursor: 'pointer',
                            transition: 'all 0.12s ease',
                          }}
                          onMouseEnter={(e) => {
                            if (!isActive) e.currentTarget.style.background = 'rgba(30, 41, 59, 0.5)';
                          }}
                          onMouseLeave={(e) => {
                            if (!isActive) e.currentTarget.style.background = 'transparent';
                          }}
                        >
                          <span
                            style={{
                              display: 'inline-block',
                              fontSize: '0.72rem',
                              fontFamily: 'monospace',
                              color: isActive ? '#38bdf8' : '#64748b',
                              fontWeight: 700,
                              minWidth: '1.2rem',
                            }}
                          >
                            {ch.number}
                          </span>
                          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {ch.shortTitle}
                          </span>
                          <IconComp size={14} style={{ color: isActive ? '#38bdf8' : '#64748b', flexShrink: 0 }} />
                        </button>

                        {/* Expandable Sub-sections for the Active Chapter */}
                        {isActive && activeSections.length > 0 && (
                          <div
                            style={{
                              margin: '0.3rem 0 0.5rem 1.65rem',
                              paddingLeft: '0.55rem',
                              borderLeft: '1px solid rgba(56, 189, 248, 0.3)',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '0.25rem',
                            }}
                          >
                            {activeSections.map((sec) => (
                              <button
                                key={sec.id}
                                type="button"
                                onClick={() => scrollToSection(sec.id)}
                                style={{
                                  background: 'transparent',
                                  border: 'none',
                                  textAlign: 'left',
                                  color: '#94a3b8',
                                  fontSize: '0.73rem',
                                  padding: '0.15rem 0',
                                  cursor: 'pointer',
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  transition: 'color 0.15s ease',
                                }}
                                onMouseEnter={(e) => (e.currentTarget.style.color = '#38bdf8')}
                                onMouseLeave={(e) => (e.currentTarget.style.color = '#94a3b8')}
                              >
                                {sec.title}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </aside>

        {/* ───────────────────────── Main Content Reader ───────────────────────── */}
        <main
          ref={contentContainerRef}
          style={{
            overflowY: 'auto',
            padding: '2rem 3rem 4rem',
            maxHeight: 'calc(100vh - 9rem)',
            scrollBehavior: 'smooth',
          }}
        >
          <div style={{ maxWidth: 880, margin: '0 auto' }}>
            {/* Breadcrumb & Metadata Badge */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: '0.75rem',
                color: '#64748b',
                marginBottom: '1rem',
                borderBottom: '1px solid #1e293b',
                paddingBottom: '0.75rem',
                flexWrap: 'wrap',
                gap: '0.5rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <span style={{ color: '#94a3b8' }}>{activeChapter.category}</span>
                <span>/</span>
                <span style={{ color: '#38bdf8', fontWeight: 600 }}>{activeChapter.title}</span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                  <Clock size={13} />
                  {activeChapter.readingTime}
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                  <FileText size={13} />
                  <code>docs/{activeChapter.file}</code>
                </span>
              </div>
            </div>

            {/* Chapter Subtitle Banner */}
            <div
              style={{
                background: 'rgba(15, 23, 42, 0.65)',
                border: '1px solid #1e293b',
                borderRadius: '8px',
                padding: '0.75rem 1.1rem',
                marginBottom: '1.75rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <span style={{ fontSize: '0.86rem', color: '#94a3b8' }}>
                <strong>Topic Scope:</strong> {activeChapter.subtitle}
              </span>
            </div>

            {/* Rendered Chapter Markdown Content */}
            <MarkdownContent
              markdownText={activeChapter.rawContent}
              onNavigateChapter={handleNavigateChapter}
            />

            {/* ───────────────────────── Chapter Navigation Footer ───────────────────────── */}
            <div
              style={{
                marginTop: '3.5rem',
                paddingTop: '1.5rem',
                borderTop: '1px solid #1e293b',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '1rem',
              }}
            >
              {activeIndex > 0 ? (
                <button
                  type="button"
                  onClick={() => setActiveChapterId(DOC_CHAPTERS[activeIndex - 1].id)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.65rem 1.1rem',
                    background: 'rgba(30, 41, 59, 0.6)',
                    border: '1px solid #334155',
                    borderRadius: '8px',
                    color: '#cbd5e1',
                    fontSize: '0.86rem',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#38bdf8')}
                  onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#334155')}
                >
                  <ChevronLeft size={16} />
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontSize: '0.68rem', color: '#64748b', textTransform: 'uppercase' }}>
                      Previous
                    </div>
                    <div>{DOC_CHAPTERS[activeIndex - 1].shortTitle}</div>
                  </div>
                </button>
              ) : (
                <div />
              )}

              {activeIndex < DOC_CHAPTERS.length - 1 ? (
                <button
                  type="button"
                  onClick={() => setActiveChapterId(DOC_CHAPTERS[activeIndex + 1].id)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.65rem 1.1rem',
                    background: 'rgba(56, 189, 248, 0.1)',
                    border: '1px solid rgba(56, 189, 248, 0.4)',
                    borderRadius: '8px',
                    color: '#38bdf8',
                    fontSize: '0.86rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(56, 189, 248, 0.18)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(56, 189, 248, 0.1)')}
                >
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.68rem', color: '#38bdf8', textTransform: 'uppercase' }}>
                      Next Chapter
                    </div>
                    <div>{DOC_CHAPTERS[activeIndex + 1].shortTitle}</div>
                  </div>
                  <ChevronRight size={16} />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onBack}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.65rem 1.1rem',
                    background: 'rgba(16, 185, 129, 0.15)',
                    border: '1px solid rgba(16, 185, 129, 0.4)',
                    borderRadius: '8px',
                    color: '#34d399',
                    fontSize: '0.86rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Return to Workspace
                  <ChevronRight size={16} />
                </button>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

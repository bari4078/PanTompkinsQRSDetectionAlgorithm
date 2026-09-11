import doc01 from '../../../../docs/01_introduction.md?raw';
import doc02 from '../../../../docs/02_ecg_fundamentals.md?raw';
import doc03 from '../../../../docs/03_pan_tompkins_algorithm.md?raw';
import doc04 from '../../../../docs/04_processing_pipeline.md?raw';
import doc05 from '../../../../docs/05_adaptive_detection.md?raw';
import doc06 from '../../../../docs/06_qrs_delineation.md?raw';
import doc07 from '../../../../docs/07_workspace.md?raw';
import doc08 from '../../../../docs/08_cardiac_conduction.md?raw';
import doc09 from '../../../../docs/09_evaluation.md?raw';
import doc10 from '../../../../docs/10_limitations.md?raw';
import doc11 from '../../../../docs/11_technical_architecture.md?raw';

/**
 * Extracts h2 (##) headings from raw Markdown text to build secondary anchor navigation.
 */
export function extractSections(markdownText) {
  if (!markdownText) return [];
  const lines = markdownText.split('\n');
  const sections = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('## ')) {
      const title = trimmed.replace(/^##\s+/, '').trim();
      // Generate URL-friendly slug
      const id = title
        .toLowerCase()
        .replace(/\[.*?\]/g, '') // remove badges like [From Pan & Tompkins]
        .replace(/[^\w\s-]/g, '')
        .trim()
        .replace(/\s+/g, '-');

      if (id && title) {
        sections.push({ id, title });
      }
    }
  }
  return sections;
}

/**
 * Canonical Documentation Registry.
 * Markdown text is loaded directly from docs/*.md using Vite's ?raw import.
 * docs/3_Python_Syntax_For_Novices.md is deliberately excluded from this registry.
 */
export const DOC_CHAPTERS = [
  {
    id: 'introduction',
    file: '01_introduction.md',
    number: '01',
    shortTitle: 'Introduction',
    title: '1. Introduction',
    subtitle: 'Application Overview & Educational Scope',
    category: 'Getting Started',
    iconName: 'BookOpen',
    readingTime: '3 min read',
    rawContent: doc01,
  },
  {
    id: 'ecg_fundamentals',
    file: '02_ecg_fundamentals.md',
    number: '02',
    shortTitle: 'ECG Fundamentals',
    title: '2. ECG Fundamentals',
    subtitle: 'Cardiac Electrophysiology & Waveform Anatomy',
    category: 'Getting Started',
    iconName: 'Heart',
    readingTime: '4 min read',
    rawContent: doc02,
  },
  {
    id: 'pan_tompkins_algorithm',
    file: '03_pan_tompkins_algorithm.md',
    number: '03',
    shortTitle: 'The Pan-Tompkins Algorithm',
    title: '3. What Is the Pan-Tompkins Algorithm?',
    subtitle: 'Origins (1985), Noise Challenges & Design Objectives',
    category: 'Algorithm & Theory',
    iconName: 'Cpu',
    readingTime: '4 min read',
    rawContent: doc03,
  },
  {
    id: 'processing_pipeline',
    file: '04_processing_pipeline.md',
    number: '04',
    shortTitle: 'Processing Pipeline',
    title: '4. Pan-Tompkins Processing Pipeline',
    subtitle: 'Mathematical Formulation of the 5 Filter Stages',
    category: 'Algorithm & Theory',
    iconName: 'Layers',
    readingTime: '6 min read',
    rawContent: doc04,
  },
  {
    id: 'adaptive_detection',
    file: '05_adaptive_detection.md',
    number: '05',
    shortTitle: 'Adaptive Decision Logic',
    title: '5. Adaptive Decision Logic',
    subtitle: 'Dual Thresholds, Refractory Blanking & Search-Back',
    category: 'Algorithm & Theory',
    iconName: 'Sliders',
    readingTime: '6 min read',
    rawContent: doc05,
  },
  {
    id: 'qrs_delineation',
    file: '06_qrs_delineation.md',
    number: '06',
    shortTitle: 'QRS Detection vs. Delineation',
    title: '6. QRS Detection vs. QRS Delineation',
    subtitle: 'Downstream Morphology Heuristics & Boundary Search',
    category: 'Downstream Morphology',
    iconName: 'Activity',
    readingTime: '5 min read',
    rawContent: doc06,
  },
  {
    id: 'workspace',
    file: '07_workspace.md',
    number: '07',
    shortTitle: 'Interactive Workspace',
    title: '7. Interactive ECG Workspace',
    subtitle: 'Playback Controls, Overlays & Beat Evidence Analysis',
    category: 'Application Features',
    iconName: 'ActivitySquare',
    readingTime: '4 min read',
    rawContent: doc07,
  },
  {
    id: 'cardiac_conduction',
    file: '08_cardiac_conduction.md',
    number: '08',
    shortTitle: '3D Cardiac Conduction',
    title: '8. 3D Cardiac Conduction Visualization',
    subtitle: 'Anatomical Pathways & Cardiac Phase Synchronization',
    category: 'Application Features',
    iconName: 'Heart',
    readingTime: '4 min read',
    rawContent: doc08,
  },
  {
    id: 'evaluation',
    file: '09_evaluation.md',
    number: '09',
    shortTitle: 'Evaluation & MIT-BIH',
    title: '9. Evaluation & MIT-BIH Benchmark',
    subtitle: 'ANSI/AAMI EC57 & Deterministic Bipartite Matching',
    category: 'Validation & Engineering',
    iconName: 'Award',
    readingTime: '6 min read',
    rawContent: doc09,
  },
  {
    id: 'limitations',
    file: '10_limitations.md',
    number: '10',
    shortTitle: 'Limitations & Notes',
    title: '10. Limitations & Important Notes',
    subtitle: 'Boundary Conditions, Assumptions & Non-Clinical Notice',
    category: 'Validation & Engineering',
    iconName: 'AlertTriangle',
    readingTime: '4 min read',
    rawContent: doc10,
  },
  {
    id: 'technical_architecture',
    file: '11_technical_architecture.md',
    number: '11',
    shortTitle: 'Technical Architecture',
    title: '11. Technical Architecture',
    subtitle: 'FastAPI Backend, React 19 Client & REST API Contracts',
    category: 'Validation & Engineering',
    iconName: 'Cpu',
    readingTime: '5 min read',
    rawContent: doc11,
  },
];

export const CATEGORIES = [
  'Getting Started',
  'Algorithm & Theory',
  'Downstream Morphology',
  'Application Features',
  'Validation & Engineering',
];

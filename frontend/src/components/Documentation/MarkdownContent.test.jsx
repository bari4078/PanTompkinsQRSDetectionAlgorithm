import { describe, it, expect } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import MarkdownContent from "./MarkdownContent";
import { DOC_CHAPTERS } from "./docsRegistry";

describe("MarkdownContent LaTeX & Math Rendering", () => {
  it("renders inline LaTeX expressions as KaTeX elements", () => {
    const md = "Cutoff frequency is $f_{\\text{low}} = 5.0\\text{ Hz}$ and band is $15\\text{ Hz}$.";
    const html = renderToStaticMarkup(React.createElement(MarkdownContent, { markdownText: md }));

    expect(html).toContain("class=\"katex\"");
    expect(html).toContain("class=\"katex-mathml\"");
    expect(html).toContain("annotation encoding=\"application/x-tex\"");
    expect(html).not.toContain("$f_{\\text{low}}");
  });

  it("renders display LaTeX equations as KaTeX display blocks", () => {
    const md = "$$\\text{Normalized cutoffs}: \\quad w_{\\text{low}} = \\frac{f_{\\text{low}}}{0.5\\cdot f_s}$$";
    const html = renderToStaticMarkup(React.createElement(MarkdownContent, { markdownText: md }));

    expect(html).toContain("class=\"katex-display\"");
    expect(html).toContain("class=\"katex\"");
    expect(html).toContain("Normalized");
  });

  it("renders single-line and indented display equations inside list items", () => {
    const md = `* **Filter Cutoffs**:
  $$\\text{Normalized cutoffs}: \\quad w_{\\text{low}} = \\frac{f_{\\text{low}}}{0.5\\cdot f_s}$$
  Default parameters: $f_{\\text{low}} = 5.0\\text{ Hz}$.`;
    const html = renderToStaticMarkup(React.createElement(MarkdownContent, { markdownText: md }));

    expect(html).toContain("class=\"katex-display\"");
    expect(html).toContain("class=\"katex\"");
  });

  it("protects code blocks and inline code from math parsing", () => {
    const md = "```python\ny[n] = (x[n]) ** 2\nTHRESHOLD_I1 = 0.5 * THRESHOLD_I1\n```\nAnd inline `THRESHOLD_I1`.";
    const html = renderToStaticMarkup(React.createElement(MarkdownContent, { markdownText: md }));

    expect(html).toContain("y[n] = (x[n]) ** 2");
    expect(html).toContain(">THRESHOLD_I1</code>");
  });

  it("generates matching anchor IDs on headings for TOC sub-navigation", () => {
    const md = "## Stage 1: Bandpass Filter\n## 5. Adaptive Decision Logic";
    const html = renderToStaticMarkup(React.createElement(MarkdownContent, { markdownText: md }));

    expect(html).toContain("id=\"stage-1-bandpass-filter\"");
    expect(html).toContain("id=\"5-adaptive-decision-logic\"");
  });

  it("renders GitHub-style alert callouts with icons and titles", () => {
    const md = `> [!IMPORTANT]
> **Important Requirement**
> This is a critical notification.`;
    const html = renderToStaticMarkup(React.createElement(MarkdownContent, { markdownText: md }));

    expect(html).toContain("Important");
    expect(html).toContain("This is a critical notification.");
    expect(html).not.toContain("[!IMPORTANT]");
  });

  it("renders scientific provenance badges", () => {
    const md = `## Bandpass Stage
[From Pan & Tompkins (1985) & Current Codebase Implementation]`;
    const html = renderToStaticMarkup(React.createElement(MarkdownContent, { markdownText: md }));

    expect(html).toContain("From Pan &amp; Tompkins (1985) &amp; Current Codebase Implementation");
  });

  it("successfully renders all canonical documentation chapters with math", () => {
    expect(DOC_CHAPTERS.length).toBe(11);
    for (const chapter of DOC_CHAPTERS) {
      const html = renderToStaticMarkup(
        React.createElement(MarkdownContent, { markdownText: chapter.rawContent })
      );
      expect(html).toBeDefined();
      expect(html.length).toBeGreaterThan(100);
      // In chapters with math, verify KaTeX markup was generated
      if (chapter.id === "processing_pipeline" || chapter.id === "adaptive_detection") {
        expect(html).toContain("class=\"katex\"");
        expect(html).toContain("class=\"katex-display\"");
      }
    }
  });
});

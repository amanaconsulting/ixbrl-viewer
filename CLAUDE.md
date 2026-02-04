# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is the **AMANA fork** of the Workiva/Arelle iXBRL Viewer - a tool for viewing Inline XBRL reports interactively in a web browser. The project has two main components:

1. **Python Plugin** (`iXBRLViewerPlugin/`) - An Arelle plugin that processes iXBRL files and generates viewer-ready HTML with embedded JSON metadata
2. **JavaScript Viewer** (`iXBRLViewerPlugin/viewer/`) - A client-side application bundled into a single `ixbrlviewer.js` file

## Build Commands

```cmd
npm install                 # Install dependencies (run once)
npm run font                # Build icon font files (required before first build)
npm run dev                 # Build development version (ixbrlviewer.dev.js)
npm run prod                # Build production version (ixbrlviewer.js)
```

Output: `iXBRLViewerPlugin\viewer\dist\ixbrlviewer.js`

## Testing

### JavaScript Tests
```cmd
npm run test                # Run all Jest unit tests
npm run test -- --testPathPattern="search"  # Run specific test file
```

Test files are co-located with source: `*.test.js` alongside `*.js` in `iXBRLViewerPlugin\viewer\src\js\`

### Python Tests
```cmd
pip install .[dev]          # Install dev dependencies
pytest tests\unit_tests     # Run Python unit tests
pytest tests\unit_tests\iXBRLViewerPlugin\test_iXBRLViewer.py  # Run specific test
```

### Puppeteer Integration Tests
```cmd
pip install .[arelle]       # Install Arelle dependency
npm run puppeteerServe      # Terminal 1: Start test server
npm run test:puppeteer      # Terminal 2: Run tests
```

## Linting

```cmd
npm run stylelint           # Lint LESS files
```

## Architecture

### Python Plugin Flow
- `__init__.py` - Plugin entry point, Arelle integration hooks, CLI options
- `iXBRLViewer.py` - `IXBRLViewerBuilder` class processes XBRL models, extracts taxonomy data, generates JSON
- `xhtmlserialize.py` - Serializes modified iXBRL documents with embedded viewer data
- `plugin.py` - Plugin data management

### JavaScript Viewer Architecture
- `ixbrlviewer.js` - Entry point, `iXBRLViewer` class, plugin system
- `reportset.js` - `ReportSet` manages loaded XBRL data, facts, and footnotes
- `report.js` - `XBRLReport` represents a single target report
- `viewer.js` - `Viewer` handles document rendering, highlighting, navigation
- `inspector.js` - `Inspector` UI panel for fact details, search, calculations
- `fact.js` / `footnote.js` - Data models for facts and footnotes

### Key Data Flow
1. Arelle loads iXBRL document
2. Python plugin extracts XBRL data into JSON (`taxonomyData`)
3. JSON is embedded in HTML along with viewer script reference
4. JavaScript loads JSON, parses iXBRL elements, initializes interactive viewer

### AMANA-Specific Extensions
- CefSharp browser embedding support (`bindEvents()`)
- Enhanced fact highlighting for non-table elements
- ESEF anchoring display in tag inspector
- Validation results injection
- Tooltips over highlighted facts
- Removed iframe usage for CSS `content-visibility:auto` support

### AMANA Zoom Implementation
The zoom functionality in `util.js:zoom()` uses CSS transforms for scaling:
- Creates a `#zoom-container` wrapper inside document body (or `#page-container` for PDFs)
- Applies `transform: scale()` with `transform-origin: center 0`
- Adjusts margins to maintain proper layout after scaling
- Preserves scroll position proportionally during zoom changes
- Used by both main viewer (`viewer.js:_zoom()`) and text block viewer dialog

### Text Block Viewer
`textblockviewer.js` provides a dialog for viewing escaped HTML text blocks:
- `TextBlockViewerDialog` class extends `Dialog` for modal display
- Only renders facts where `isTextBlock()` and `escaped()` are true
- Supports plain text toggle via checkbox
- Has independent zoom controls (+/-)
- Plugin extensible via `extendDisplayTextblock` hook for custom rendering

### Plugin System
The viewer supports runtime plugins via `iXBRLViewer.registerPlugin()`:

**Available Plugin Hooks:**
- `preProcessiXBRL(bodyElement, docIndex)` - Called during initialization for each document
- `updateViewerStyleElements(styleElts)` - Modify/extend viewer CSS
- `extendDisplayOptionsMenu(menu)` - Add items to display options menu
- `extendHighlightKey(key)` - Extend highlight color key labels
- `extendDisplayTextblock(doc, fact)` - Custom text block rendering in iframe

**Plugin Methods:**
- `hasPluginMethod(name)` - Check if any plugin implements a method
- `callPluginMethod(name, ...args)` - Call method on all plugins synchronously
- `pluginPromise(name, ...args)` - Call method on all plugins as async chain

## Webpack Configuration

- `webpack.common.js` - Shared configuration
- `webpack.dev.js` - Development build
- `webpack.prod.js` - Production build (minified)

Entry point: `iXBRLViewerPlugin\viewer\src\js\index.js`

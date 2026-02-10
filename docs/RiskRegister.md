# Risk Register

## Active Risks

### R1: Script Load Order Dependencies
- **Severity**: HIGH
- **Description**: The original code relies heavily on global variable availability in specific order. Splitting into files means each `<script src>` must be in the exact right position.
- **Mitigation**: index.html preserves the exact same load order as the original file's script blocks. Each file was extracted from a specific line range in the original.
- **Status**: Mitigated by ordered `<script>` tags

### R2: Missing Code Sections
- **Severity**: MEDIUM
- **Description**: Some line ranges between extraction boundaries may contain code that was not extracted.
- **Mitigation**: Extraction script covers all major sections. Original file preserved for reference. Gaps are primarily HTML comments, section headers, and `window.TU` export lines.
- **Status**: Monitored - original file available for cross-reference

### R3: CSS Specificity Changes
- **Severity**: LOW
- **Description**: Splitting CSS into multiple files changes the cascade order slightly compared to multiple `<style>` blocks in the original.
- **Mitigation**: CSS files are loaded in the same order as the original `<style>` blocks. The frost-theme and performance CSS (which use `!important`) maintain their override behavior.
- **Status**: Mitigated by load order

### R4: Network Latency on Multi-file Load
- **Severity**: LOW  
- **Description**: Loading 50+ separate files is slower than a single file on first visit.
- **Mitigation**: 
  1. Files are small and can be HTTP/2 multiplexed
  2. Browser caching means subsequent loads are faster
  3. A build step (Vite/Rollup) can be added to bundle for production
- **Status**: Accepted tradeoff for development; production build recommended

### R5: Inline Component CSS (Single Line)
- **Severity**: LOW
- **Description**: The first `<style>` block in the original was a very long single line. It was extracted as-is to `css/inline-components.css`.
- **Mitigation**: Content is identical; formatting can be improved later without affecting behavior.
- **Status**: Accepted

## Resolved Risks

### R6: HTML Tag Leakage in Extracted Files
- **Severity**: MEDIUM
- **Description**: `sed` extraction may include `<script>` or `<style>` tags
- **Resolution**: Post-extraction cleanup removed all HTML tags from JS/CSS files
- **Status**: RESOLVED

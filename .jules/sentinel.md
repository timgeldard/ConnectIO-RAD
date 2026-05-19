## 2026-05-19 - Missing Input Sanitization in Standalone HTML Files
**Vulnerability:** XSS vulnerability through `dangerouslySetInnerHTML` without proper sanitization in standalone apps.
**Learning:** Standalone, single-page apps (like `apps/platform/standalone/factory-mood-board/index.html`) using React with Babel standalone may still use `dangerouslySetInnerHTML`. Since these files don't undergo a build process with NPM dependencies, developers might skip sanitizing user input, leading to XSS vulnerabilities.
**Prevention:** Always verify that `dangerouslySetInnerHTML` is passed sanitized content (e.g. `DOMPurify.sanitize(content)`). In environments without module bundlers, use external CDNs to import DOMPurify (`https://unpkg.com/dompurify@3.1.5/dist/purify.min.js`).

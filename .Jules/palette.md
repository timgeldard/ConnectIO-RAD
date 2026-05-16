## 2024-05-16 - Add ARIA Labels to Key Shared Components
**Learning:** Found that some shared UI components like DataTable (checkboxes, pagination buttons), Modal (close button), and TopBar (search input) lacked ARIA labels, which impacts accessibility across the entire application where these components are used.
**Action:** Added `aria-label` attributes to these icon-only or visually-implied interactive elements to ensure they are properly announced by screen readers, following the pattern of making UI components more inclusive.

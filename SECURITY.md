# Security Policy

## Supported Versions

Only the current `main` branch is actively supported with security fixes.

| Version | Supported |
|---------|-----------|
| main    | Yes       |

## Reporting a Vulnerability

**Do not open a public GitHub issue for security vulnerabilities.**

Report vulnerabilities privately by emailing the platform team at the address
on file with your manager, or by using GitHub's private vulnerability reporting
feature (Security → Report a vulnerability).

Please include:
- A description of the vulnerability and its potential impact
- Steps to reproduce or a proof-of-concept
- Any suggested mitigations

**Response timeline:**
- Acknowledgement: within 2 business days
- Initial triage: within 7 business days
- Remediation: depends on severity; critical issues target 30-day resolution

## Scope

This policy covers the ConnectIO-RAD Databricks Apps platform. Third-party
platform issues (Databricks, Azure) should be reported to those vendors directly.

## Data Classification

ConnectIO-RAD serves industrial manufacturing analytics, including quality,
traceability, environmental monitoring, process-order, and inventory data. Treat
this data as sensitive manufacturing intellectual property unless a business data
owner has explicitly classified it otherwise.

Default handling expectations:
- **Restricted:** authentication tokens, user identity headers, audit logs with
  personal data, production credentials, and workspace configuration.
- **Confidential:** batch genealogy, supplier traceability, quality results,
  process-order performance, warehouse inventory, and manufacturing KPIs.
- **Internal:** generated demo data, non-production screenshots, and development
  diagnostics that do not include real production identifiers.

Do not paste Restricted or Confidential data into public issues, external AI
tools, logs without masking, or pull-request comments.

## Application Cache Retention and Purge

The shared SQL runtime uses process-local in-memory LRU/TTL caches for selected
read-only dashboard queries. Cached rows may include Confidential manufacturing
data such as quality metrics, inventory snapshots, batch genealogy, and
traceability summaries. The cache is never written to disk and must not contain
authentication tokens, raw authorization headers, credentials, or unrestricted
personal data.

Default retention limits:
- Metadata lookups: maximum 15 minutes.
- Scorecards and KPI summaries: maximum 5 minutes.
- Chart and dashboard reads: maximum 3 minutes.
- Legacy single-tier runtime and data-freshness caches: maximum 5 minutes unless
  an app explicitly configures a shorter TTL.

Purge events:
- TTL expiry and LRU eviction automatically remove stale entries.
- `SqlRuntime.clear_cache()` purges all configured cache tiers.
- Write statements clear read caches by default after successful execution.
- Databricks App restart, redeploy, or scale-down clears process memory.

User-specific, Restricted, or regulated personal-data endpoints must bypass this
shared cache or configure a shorter app-specific TTL. Token validation and audit
logging are separate concerns; bearer tokens must not be included in shared data
cache keys or stored in cached rows.

## Browser-Side State and Security Headers

Application state that can include plant, floor, persona, or filter context
should use session-scoped storage by default. Persistent browser storage is only
appropriate for low-sensitivity preferences with an explicit product/security
review. Session-scoped state must be cleared on the shared `connectio:logout`
browser event and should have a bounded TTL.

Backends created through the shared API app factory attach conservative browser
security headers by default, including CSP, HSTS, `X-Content-Type-Options`,
`X-Frame-Options`, Referrer-Policy, Permissions-Policy, and no-store caching.
Production app factories disable OpenAPI and interactive docs unless explicitly
enabled for a controlled diagnostic session.

## Regulatory and Privacy Considerations

Security triage must consider applicable food-manufacturing and privacy
obligations, including FSMA preventive-controls expectations, GFSI-aligned audit
readiness, customer traceability commitments, and GDPR obligations for personal
data such as user identity, email, audit trail, and access logs.

When a vulnerability may expose personal data or regulated traceability records,
the incident owner must involve legal/privacy and the accountable data owner to
assess notification obligations, data residency constraints, and customer or
regulator communication requirements.

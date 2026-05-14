# ADR-005: shared-geo deferred — no forced integration

- **Status:** Accepted — deferred pending concrete use case
- **Date:** 2026-05-14

## Context

`libs/shared-geo` provides postal geocoding utilities (pgeocode + Nominatim fallback, country-code normalisation, `geocode_postal_code`, `enrich_with_postal_geocodes`). It is a well-structured, production-quality library. However, at the time of this decision it has no production imports — only a test stub in `apps/envmon/backend/tests/conftest.py` and a wheel entry in `apps/platform/scripts/build.py`.

Two integration candidates were evaluated:

- **envmon `spatial_config`** — plant geo coordinates currently arrive from the database (`gold_plant_geo` view); postal geocoding is not needed for the heatmap or floor plan flows.
- **W360 plant context** — plant cards display lat/lon from the warehouse. Adding postal geocoding would enrich plants that lack database coordinates, but this is not a current user request.

## Decision

Do not force integration. `shared-geo` stays in the library but remains unused by production code until a concrete use case justifies the `pgeocode` runtime dependency (a ~15 MB download).

The library is kept (not deleted) because:
1. The geocoding logic is non-trivial and should not be re-implemented per-app.
2. A future feature (e.g. enriching plant profiles with approximate lat/lon from postal codes) will have a ready-made, tested implementation.

## Consequences

- No app imports `shared_geo` in production paths.
- The wheel continues to be built and bundled so the import resolves in deployed environments (avoids a latent `ModuleNotFoundError` if a future code path references it before this ADR is revisited).
- Revisit when: envmon or W360 receives a request to display plants that have postal codes but no database-supplied coordinates.

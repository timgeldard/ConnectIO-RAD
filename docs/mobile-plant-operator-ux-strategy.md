# Mobile / tablet UX strategy for plant operators

- **Status:** Draft — direction set, exemplar journey not yet built
- **Date:** 2026-05-11
- **Architecture review finding:** S-4
- **Owner:** TBD (Platform UX + Warehouse360 + POH leads)

## Problem statement

The platform's seven SPAs were designed for **knowledge-worker desktop**
ergonomics — wide tables, three-pane layouts, mouse-driven filtering,
keyboard shortcuts.  However, the bulk of *operational* users sit on the
plant floor:

- Dispensary operator picking raw materials at a weighing station
- Line operator clearing a deviation between batches
- Sanitation lead recording a swab result in a wet area
- Shift handover at a tablet kiosk

These users are wearing PPE, may be standing, may be wet-gloved.  A
desktop SPA on a tablet *technically loads* — Galaxy Tab S4 is already in
the Playwright matrix — but it is not *usable* for the specific tasks
that matter.

The current platform shell is a "list of modules" interface.  Operators
do not think in modules; they think in *tasks*.

## Direction

Identify the **three critical plant-floor journeys** and design each one
tablet-native, with a small set of large touch targets, minimal text
input, and offline-tolerant state.  Everything else (the wide analytical
journeys for QA managers and supply analysts) stays desktop-first.

### The three operator journeys

| # | Journey | Today | Tablet-native target |
|---|---|---|---|
| 1 | **Dispensary pick** — operator scans handling unit, confirms BOM line, records weighed quantity | Warehouse360 desktop view; small text in dense table | Single full-screen card per BOM line; large numeric keypad; auto-tolerance feedback; barcode-camera input |
| 2 | **Deviation log** — line operator records a quality or process deviation at the line | Not currently supported (no CAPA module) | Quick-tap "What went wrong?" tile grid → severity slider → optional photo → submit; queues offline; syncs when back online |
| 3 | **Line clearance** — operator confirms a line is empty and clean before the next batch | Mixed: paper checklist + Warehouse360 + SPC | One-screen checklist with large checkboxes; photo evidence for sanitation step; SPC last-batch alarm summary inline |

These three journeys cover the daily ops of the two highest-frequency
operator personas (dispensary and line) and have the clearest ROI from
moving off paper.  Everything else stays desktop-first.

## Design principles

1. **Tile, don't table.**  An operator looks for one item out of three,
   not one out of forty.  Cards with large targets beat dense rows.
2. **One thumb.**  All primary actions reachable in the bottom 60% of a
   10-inch tablet screen.
3. **Numbers over text.**  Scale, weight, count.  No free-text where a
   numeric keypad will do.
4. **Camera over keyboard.**  Barcode scan for HU IDs, photo evidence
   for deviations and cleans.
5. **Optimistic + offline-tolerant.**  Lossy WiFi in wet areas is real.
   Queue writes locally; sync in background; surface conflicts loudly.
6. **No three-pane layouts.**  Operator screens are linear.  Drill-down
   = full-screen swap.
7. **PPE-friendly.**  Touch targets >= 64 px.  No hover affordances —
   gloves don't hover.

## Technical implications

- The platform shell needs a **persona axis** alongside its module axis.
  A new shell route `/operator?journey=dispense` chooses persona and
  journey at login, bypassing the module list entirely.
- The `useAppRouter` helper (`libs/shared-app-context`) already supports
  shell-forwarded navigation via `onNavigate`; operator journeys can
  reuse it without a new routing layer.
- A new shared component library `libs/shared-operator-ui` should host
  tile, big-number-keypad, severity-slider, camera-capture, and
  signed-evidence-photo components.  Distinct from `shared-ui` because
  the design tokens (font sizes, target sizes, contrast ratios) differ.
- The `@smoke` Playwright matrix already includes Galaxy Tab S4 — extend
  it to include three new `@operator` tests, one per journey, on Mobile
  Chrome viewport.
- Offline tolerance requires a small persistence layer.  Pick one:
  IndexedDB via `idb-keyval`, or a Service Worker with Workbox.  Avoid
  full Redux-Persist.

## Suggested phasing

1. **Spike (1 sprint)** — UX designer plus one engineer prototype the
   dispensary pick journey end-to-end on a tablet, measuring task
   completion time vs the current desktop SPA.  Outcome: GO / NO-GO.
2. **Foundation (2 sprints)** — `libs/shared-operator-ui` primitives,
   shell persona route, IndexedDB write-queue.
3. **Journey 1 ship (2 sprints)** — dispensary pick journey to pilot
   plant.
4. **Measure (2 sprints)** — collect task-completion-time deltas; iterate.
5. **Journey 2 and 3 ship** — only after journey 1 has proven value.

## Out of scope (deliberate)

- Native iOS/Android apps.  PWA + tablet browser meets the requirement
  with less ongoing cost.  Revisit if barcode-camera latency is a
  blocker.
- Rugged-device-specific drivers (Honeywell, Zebra).  Standard browser
  camera/keyboard APIs cover the listed journeys.
- Voice input.  Promising but high noise-floor in plant environments;
  defer until a customer specifically asks.
- Operator-side analytics dashboards.  The platform's strength is
  capture and reporting; analytics stays on desktop.

## Next concrete step

Schedule a 30-min discovery with one dispensary operator at the pilot
plant.  Watch them complete three pick tasks on the current desktop
Warehouse360 SPA on a tablet.  Time each, note every failure point.
That recording is the brief for the spike.

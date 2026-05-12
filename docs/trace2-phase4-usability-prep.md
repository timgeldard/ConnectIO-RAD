# Phase 4 usability session prep — trace2 advanced traceability

- **Status:** Ready to run; awaiting a scheduled session with a QA investigator
- **Date drafted:** 2026-05-12
- **Owner:** TBD (trace2 frontend lead)
- **Estimated session duration:** 60 minutes per participant
- **Recommended sessions:** 3 — different recall profiles per session
  (cross-site, single-plant, supplier-quality)

## Why this session matters

Phase 0–3a shipped the **Advanced** lineage view, **Sankey** flow
overview, **Table** view, **high-contrast** theme, **export** menu, and
the **right-click "Explain this transfer"** dispatch surface.  Each of
those was driven by an engineering hypothesis about how a QA
investigator works.  Phase 4 validates those hypotheses against
real investigators on real recall scenarios.

We are not running an A/B test.  We are running a structured
think-aloud session — the participant narrates what they are trying to
do, where they look, and what they expect to happen next.  Friction
points emerge from the narration even when the participant completes
every task successfully.

## Recruiting

**Two participants minimum, three preferred.**  All three should have
investigated at least one real recall in the last 12 months.  Two
should be QA managers (recall coordinators); one should be a lab tech
or shift supervisor who has been **pulled into** an active recall.
The mix matters because the two personas have different visual
literacy — the QA manager has dashboards in their daily life; the
shift supervisor does not.

**Avoid:** anyone who has already seen the advanced view in dev.
Familiarity with the chrome corrupts the friction signal.

## Equipment

- A laptop running the **standalone trace2** SPA (UAT data, not prod —
  recall scenarios in prod are not safe to demo against).
- One of the three **scenario seed batches** (see below) loaded as the
  default landing batch via the URL param
  `?batch=<seed>&material=<material>`.
- Screen recording software (Loom / built-in macOS screen recorder).
- A notebook for the observer — **paper, not a laptop**.  Typing
  during the session changes how the participant feels watched.

## Scenarios

Three scenarios, each chosen to exercise a different part of the
advanced view.  Pre-load each into a fresh tab so the participant
switches scenarios with one click.

### Scenario A — Cross-site recall (Advanced + Sankey strengths)

> *Context: A complaint about an off-flavour in a customer batch has
> been escalated.  You need to confirm whether the off-flavour can be
> traced to a single raw-material supplier or whether multiple inputs
> are implicated.*

- **Seed:** A batch that fans into 5+ raw materials across 2+ plants,
  with at least two parallel suppliers for the same material.
- **What this exercises:** Smart grouping (group-by Plant), path-qty
  overlay (heavy vs light edges), Sankey overview.

### Scenario B — Single-plant deviation (Table + filter strengths)

> *Context: A deviation report came in citing batch X.  The QA lead
> asks you to list every batch that consumed that input, ranked by
> quantity, so they can decide how aggressively to hold downstream.*

- **Seed:** A batch with 15+ direct downstream consumers, all at the
  same plant.
- **What this exercises:** Table view, sort by flow_qty, CSV export.

### Scenario C — Supplier-quality investigation (Genie + Explain strengths)

> *Context: The supplier of one of your raw materials has issued a
> recall notice.  You need to find every customer batch downstream of
> any batch of that material — without manually walking the lineage.*

- **Seed:** A batch chosen so that one of its upstream materials has
  a known wide downstream fanout.
- **What this exercises:** Right-click "Explain this transfer" →
  Genie drawer; depth-cap interaction; link-filter chips.

## Task scripts (per session)

Read each task aloud, then **stop talking**.  Do not paraphrase the
observed behaviour back to the participant.  If they ask "what should I
click here?", reply "what would you normally do?" and let them
explore.

| # | Task | Targeted view | What you're looking for |
|---|---|---|---|
| 1 | "Open the focal batch.  Tell me one thing about it that surprises you." | Classic lineage (default) | Whether they spot the focal yellow accent + plant context; whether the classic view feels familiar |
| 2 | "Switch to the *Advanced* view.  Find one upstream batch from a different plant.  Where would you click to learn more?" | Advanced graph | Discoverability of: link colours, group-by, right-click context menu |
| 3 | "Turn on *Group by Plant*.  Has anything become clearer?  Has anything become harder?" | Advanced + grouping | Whether grouping helps the cross-site narrative or feels like an extra layer |
| 4 | "Switch to *Sankey*.  Tell me which downstream customer received the most material." | Sankey | Whether width-encoding reads as "more material" without prompting |
| 5 | "Switch to *Table*.  Sort by Flow qty.  Export to CSV and open it." | Table + export | Whether the export flow feels familiar; whether CSV columns match expectations |
| 6 | "Right-click the heaviest downstream node and choose *Explain this transfer*.  Read Genie's answer aloud." | Advanced + Genie | Whether the prompt context is sufficient; whether the answer feels actionable |
| 7 | "Reduce the upstream depth slider to 1.  Why might you do that during a recall?" | Filter chips | Whether the depth control feels like a recall-investigation tool or a developer toggle |
| 8 | "Save a PNG of the current view.  Where would you put that file?" | Export menu | Whether filename + location match how investigators currently file evidence |

Each task is timed roughly.  Don't show the participant a stopwatch —
you want signal on **friction**, not throughput.

## Observation template

For each task, capture:

| Field | Example |
|---|---|
| Task # |  3 |
| Time to complete |  ~45s |
| Discoverability — did they find the control without prompting? |  Yes / No / With nudge |
| Confidence — did they hesitate before clicking? |  Yes / No |
| Mental model match — did the result match their expectation? |  Yes / No / "I thought it would also…" |
| Direct quote |  *"Why isn't the qty in kilos here?"* |
| Friction note |  Group-by chip is too small for tablet touch |

A single observer can capture this in real time.  A second observer in
the same room is overkill — they tend to ask leading questions.

## Post-session debrief (15 min)

Ask three questions, in this order:

1. **"What would you tell a colleague who had to use this tomorrow?"** —
   surfaces the participant's top-of-mind takeaway.
2. **"What's the one thing you'd change?"** — forces them to prioritise.
3. **"What's the one thing you'd keep exactly as it is?"** — anchors
   the change list in what is already working.

Do not ask "did you like it?".  Yes/no questions kill the signal.

## Synthesis (next-day, 60 min)

Group friction notes into three buckets:

- **Bug** — the view does the wrong thing.  Direct ticket.
- **Affordance miss** — the right thing is hidden or wrongly labelled.
  Goes into a Phase 4-followups epic.
- **Mental-model mismatch** — the view does the right thing but the
  investigator expected something else.  These are the most valuable
  findings and usually warrant a design conversation, not a code
  ticket.

The synthesis lives in `docs/trace2-phase4-findings.md` once captured.

## Out of scope for these sessions

- Performance perception.  Phase 4's vitest benchmark covers
  transform + layout time at 50/100/200 nodes.  Participants will
  feel layout delay but we are not measuring it here.
- Accessibility audit.  WCAG conformance needs a different protocol
  (screen reader walkthrough, keyboard-only navigation) and a
  different participant set.  Tracked separately.
- Mobile / tablet ergonomics.  Tracked in
  `docs/mobile-plant-operator-ux-strategy.md` (S-4 from the
  architecture review).

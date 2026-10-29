# SLA calculation foundation

## Status and scope

This is a standalone calculation foundation in `server/src/services/slaService.ts`. It is pure TypeScript and does not connect to MongoDB, read application records, create ticket collections, expose routes, or modify the resolution-time model. The ticket model, ticket API, UI, and business-approved SLA targets do not exist yet. This is not end-to-end SLA functionality.

## Policy configuration

Callers supply an immutable `SlaPolicyVersion` keyed by a stable policy ID and version. It has an `effectiveFrom`, optional exclusive `effectiveUntil`, and a `targetsByPriority` map keyed by the priority value chosen by the future ticket contract. Each priority entry must provide:

```ts
{
  responseTargetHours: number;
  resolutionTargetHours: number;
  atRiskWithinHours: number;
  timeBasis: 'calendar_hours' | 'business_hours';
}
```

The policy interface is defined in `slaService.ts`. The calculation adapter verifies that a provided ticket creation timestamp falls within the supplied policy version's effective range. Policy selection/storage is not implemented.

No priority names or target values are hardcoded here. Targets and at-risk thresholds must be finite, non-negative hours. A missing priority policy throws an error; the service has no implicit fallback. Zero-hour targets are allowed and become immediately breached for an unresolved ticket at or after its start.

The current implementation supports **calendar hours only**. Passing `business_hours` is rejected explicitly; it is never silently treated as calendar time. Working schedules, timezone-aware business calendars, holidays, and DST behavior are deferred. They require an agreed timezone/calendar policy and additional tests before they can be enabled.

## Calculation rules

- `asOf` is required and injected by the caller, making evaluation deterministic. `calculateTicketSla` evaluates response and resolution targets independently from the same creation timestamp, but uses separate completion and pause inputs.
- A missing start timestamp, or a start later than `asOf`, returns `not_applicable` with null deadline, remaining, and elapsed values.
- String timestamps must include an explicit `Z` or `±HH:MM` timezone offset. Date objects are already absolute instants. Inputs with local/naive timestamps are rejected so host timezone settings cannot change results.
- An elapsed duration is `asOf - start - union(overlapping explicit pauses)`. Overlapping pauses are merged so elapsed time is never subtracted twice. Pauses are clipped to the evaluated interval. A pause with no end is treated as active through `asOf`.
- A deadline is the start plus target hours plus explicit closed pause time that intersects the evolving target window. For a currently active open pause, deadline is null because the resume time is unknown. `clockPaused` reports that condition.
- An unresolved target is `breached` when remaining time is zero or negative; otherwise it is `at_risk` when remaining time is at or below the configured threshold; otherwise it is `on_track`.
- A completion at or before its target is `met`; a later completion is `breached`. `remainingHours` at completion is the target minus actual elapsed hours and can be negative for a breach.
- If a valid `reopenedAt` is later than the latest `completedAt` and no later completion has occurred by `asOf`, the resolution SLA is active again. Reopening resumes the original creation-time clock; it does not restart the target. Explicit pause intervals are the only way to stop that clock. Response SLA is evaluated from `firstResponseAt` and is not changed by reopening.
- A supplied completion or reopening timestamp earlier than the start is rejected. Pause starts later than `asOf` and pause ends earlier than their start are rejected. Invalid timestamps, negative/non-finite targets, invalid policy ranges, and unsupported business-hour basis are rejected.
- Statuses are `not_applicable`, `on_track`, `at_risk`, `breached`, and `met`. `on_track` covers an applicable, unresolved target with more time remaining than its configured at-risk threshold.

These are technical defaults for a reusable service, not approved business policy. Product owners must confirm whether resolution SLA restarts or resumes after reopen, which states pause SLA clocks, and how completion/reopen corrections are represented.

## Prediction separation

The SLA deadline is calculated only from explicit SLA targets, start time, and pause intervals. The resolution-time model's predicted duration is not used as a target, deadline, pause, or actual outcome. If future requirements need a predicted breach-risk comparison, accept prediction output as a separate optional comparison input with its model version and prediction timestamp; never change the official SLA deadline from that value.

## Future ticket integration contract

When the ticket workflow is agreed, an API/service adapter can call `calculateTicketSla` with:

- persisted creation timestamp;
- configured priority and versioned response/resolution policy;
- first-response timestamp and actual latest resolution timestamp;
- explicit reopen timestamp/event history;
- explicit response and resolution pause intervals with start/end timestamps;
- a server-provided evaluation timestamp (`asOf`).

The minimum ticket data needed for evaluation is:

- `createdAt` and the agreed priority value;
- `firstResponseAt` (actual first qualifying human/automated response, as product defines);
- latest `resolvedAt` and `reopenedAt` event timestamps, or preferably an ordered resolution event history when repeated cycles must be audited;
- separate explicit response and resolution pause intervals with start/end timestamps (plus reason/actor metadata in the future API/audit contract);
- the immutable SLA `policyId` and `policyVersion` committed when the ticket is created.

When a new policy is published, create a new version with a new effective range; never edit a version already referenced by tickets. At ticket creation, select the effective policy and persist its ID/version and, if required for forensic durability, a snapshot of the response/resolution target values and time basis. Later policy changes apply only to tickets created under that version unless an explicit, audited migration/recommit workflow is approved. Recalculating an old ticket should load its pinned version, not the current policy. The current pure service accepts the version from the caller but does not persist or select it.

A future ticket detail API could return a compact SLA object such as:

```ts
{
  policy: { policyId: string; version: string };
  evaluatedAt: string; // ISO-8601 UTC
  response: {
    status: 'not_applicable' | 'on_track' | 'at_risk' | 'breached' | 'met';
    deadlineAt: string | null;
    remainingHours: number | null;
    elapsedHours: number | null;
    clockPaused: boolean;
  };
  resolution: { /* same fields as response */ };
}
```

The service currently returns `Date` objects for deadline fields and does not construct this serialized API shape. The future route should serialize dates as ISO-8601 UTC, preserve nulls for not-applicable/unknown deadlines, and return response and resolution independently.

Dashboard summaries should separately count response and resolution outcomes for a stated `evaluatedAt` snapshot. For each dimension, provide a ticket count by each status (`not_applicable`, `on_track`, `at_risk`, `breached`, `met`), plus the total evaluated count and applicable count. `not_applicable` is visible but excluded from an SLA attainment denominator. Any future attainment percentage must define its numerator (for example, `met`) and denominator (applicable completed tickets, if that is the agreed business definition); do not derive rates until the ticket set, completion semantics, filters, and denominator are agreed. The current service calculates one ticket only and supplies no dashboard metrics.

The ticket contract must also define stable priority values, lifecycle statuses, first response semantics, resolution/reopen event semantics, pause reasons and authorization, the schedule timezone, and policy effective dates/versioning. Keep calculated SLA fields distinct from the actual resolution outcome and from ML predictions. Ticket ownership, indexes, API response shape, and UI rendering remain the responsibility of the future ticket implementation; do not persist a guessed SLA snapshot until that integration contract is approved.

## Limitations

- Calendar-time calculation only; no business calendars or holidays.
- Pause intervals are supplied by the caller; this module does not decide who may pause a ticket or which statuses imply a pause.
- Current reopening semantics resume the original SLA clock. A product decision may require a different rule.
- The calculation input accepts the latest resolution and reopen timestamps; the caller must supply the latest event state correctly. Full event history/audit is outside this module.
- No storage, audit history, policy administration, HTTP routes, ticket authorization, or UI is included.

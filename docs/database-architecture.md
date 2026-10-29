# OpsPilot AI database architecture

## Audit scope and current state

The current product implements an authenticated prediction-history application. It does not currently expose a ticketing workflow. Repository inspection found no ticket, ticket-comment, assignment-history, team, recommendation-approval, or audit-log Mongoose model or route. The database work therefore documents those as future contracts instead of creating unused collections or guessing Ishika's implementation.

The server uses Mongoose 8 with the `MONGODB_URI` setting loaded by `dotenv`. `server/.env.example` defaults to a local `opspilot` database; the actual `.env` file was present but was not read or printed. `connectDatabase()` connects with a five-second selection timeout. A read-only connection and `admin().ping()` succeeded against the configured database; no application data was read or written. Connection failure diagnostics now redact driver details from logs and health status.

| Model / collection | Existing fields and constraints | Current use |
|---|---|---|
| `User` / `users` | `name`, unique lowercased/trimmed `email`, `passwordHash` excluded from normal selection and JSON, `role` (`user`/`admin`), `themePreference`, Mongoose timestamps | Signup/login, current user and profile/preferences. Public signup schema does not accept a role and creation relies on the model default `user`. |
| `Session` / `sessions` | `userId` ref to User, unique `tokenHash`, `expiresAt`, `lastUsedAt`, timestamps; TTL on `expiresAt` | Opaque HTTP-only session cookie; only HMAC token hashes are stored. |
| `Prediction` / `predictions` | `userId`, `modelId`, optional `modelVersion`, `predictionType`, resolution input (`issueCreated`, `priority`, `issueType`, `project`), optional output duration with `hours` unit, `success`/`failed` status, `errorCode`, timestamps | Resolution inference history and user-scoped history/dashboard. It records an estimate, not an actual resolution outcome. |

### Existing query patterns and indexes

- `User.email` has a unique index and an explicit `index: true`; the latter is redundant with `unique: true` and should be avoided in a future model cleanup. Signup performs a pre-check, but the unique index remains the concurrency-safe authority.
- `Session.tokenHash` is unique and indexed; `userId` is indexed; expiration has a TTL index.
- `Prediction.userId` and `modelId` are indexed. Compound indexes cover `{ userId, createdAt }` and `{ userId, modelId, createdAt }`, matching owner-scoped history filters and sort order.
- Prediction detail and deletion queries include the authenticated `userId`; dashboard aggregations match the same ID.

## Security and integrity observations

- Passwords are hashed with Argon2id. Raw session tokens are never stored; responses use a public-user serializer.
- Signup input is allow-listed by Zod and cannot set `role`. Email is trimmed and lowercased by validation and the Mongoose schema. The unique index prevents duplicate normalized emails.
- Authentication is enforced by Express middleware for user, prediction, model, and dashboard routes. There are no ticket routes yet, so customer/IT/admin ticket authorization cannot be claimed as implemented.
- `User` currently has no account-status field, and login/authentication does not support disabling accounts. Add status only with the account-management contract that consumes it.
- Prediction input and output are structured, but the record has no ticket reference because predictions are currently created from manual form inputs. It contains no actual resolution timestamp or duration.
- The database connection previously retained and logged the raw driver error, potentially revealing deployment details. It now reports a fixed redacted diagnostic.

## Roles and authorization

### Verified implementation

- Persisted User roles are currently `user` and `admin`, with `user` as the model default. There is no `it` enum value and no Customer/IT Team role mapping in the running backend.
- Public signup does not accept a role: its Zod schema omits role and the route creates a user from an explicit allow-list. Unknown `role` input is stripped by the current Zod object schema; the model default supplies `user`.
- `requireAuth` validates the opaque session cookie, loads the referenced user, and attaches it to the request. Protected routers currently use authentication, but not role authorization.
- A reusable `requireRole(...roles)` guard now exists in `server/src/middleware/auth.ts`. It is designed to be mounted after `requireAuth`, returns 401 when no authenticated user is attached, 403 when their role is not allowed, and calls `next()` for allowed roles. It does not change the role enum or grant any role by itself. No ticket route currently uses it.
- The User schema now has an optional normalized lowercase username with a partial unique index over string usernames, preserving existing documents that have no username (and excluding explicit nulls). Public signup persists only name, email, and the Argon2id password hash; it cannot set username or role.
- `GET /api/v1/admin/me` is protected in order by `requireAuth`, `requireRole('admin')`, and the fixed provisioned-owner identity guard. The identity guard requires both database-authenticated Admin role and username `deepti10648`; matching the username alone never authenticates. The route is an identity check, not an Admin account provisioning route.
- A provisioning command and a pure provisioning service exist, but no account has been provisioned by this change. The production user collection was not queried or modified.

### Proposed mapping (subject to product-owner confirmation)

| Stored role | Proposed product role | State |
|---|---|---|
| `user` | Customer | Proposed only; keep existing stored value for backward compatibility if approved. |
| `it` | IT Team | Proposed new role; do not add to the User enum until approved with its authorization policy. |
| `admin` | Admin | Existing stored role; privileged provisioning only. |

Public signup must always create the least-privileged role (`user` under the current implementation; Customer only after mapping approval). Signup must never accept or apply `it` or `admin`. Admin and IT provisioning should use a trusted, authenticated operator process with auditability; no public role-selection endpoint should exist. Do not migrate existing users as part of defining this policy.

### Single-owner Admin provisioning

The fixed owner username is `deepti10648`. Do not use that username as a login credential; normal login remains email plus password, and Admin access additionally requires a valid session whose loaded database user has both role `admin` and this username. There is no role selector in signup or profile updates.

The one-time command is `npm run admin:provision` from `server/`. It requires the existing `MONGODB_URI` plus temporary, explicitly configured values:

| Variable | Requirement |
|---|---|
| `ADMIN_PROVISION_ACTION` | `provision` or `reset-password`. |
| `ADMIN_USERNAME` | Must normalize to the fixed value `deepti10648`. |
| `ADMIN_OWNER_EMAIL` | The owner email, normalized to lowercase. Verify ownership out of band before setting the confirmation flag. |
| `ADMIN_OWNER_EMAIL_VERIFIED` | Must be exactly `true`; this is an operator attestation, not an email verification mechanism. |
| `ADMIN_OWNER_NAME` | Owner display name, required and validated. |
| `ADMIN_PROVISION_CONFIRM` | Exact action confirmation: `PROVISION deepti10648` or `RESET PASSWORD deepti10648`. |
| `ADMIN_INITIAL_PASSWORD` | Required only to create an account or reset its password; minimum 16 characters. Supply through a secret manager/secure deployment environment, never source control or command arguments. It is hashed with the existing Argon2id implementation and is never printed. |
| `ADMIN_ALLOW_EXISTING_USER_PROMOTION` | Set to `true` only after explicit review when the exact owner email already belongs to a normal user that should become the owner Admin. Otherwise provisioning fails closed. Existing password is retained during role promotion. |

Provisioning inspects only the account matching the configured username/email and whether another Admin exists. It refuses ambiguous username/email matches, mismatched identities, unsupported roles, another existing Admin, and unapproved promotion. New accounts are created once; rerunning against the same owner Admin is a no-op and does not reset the password. Reset requires the existing exact owner Admin, the explicit reset action/confirmation, and a new secure password. The command logs only an operation status or a generic failure; it does not print emails, usernames, account IDs, hashes, passwords, tokens, or database errors.

This repository change does not execute the command. Before production use, the owner/operator must review the code and intended email, verify ownership out of band, confirm the target database, and explicitly approve provisioning. If another Admin exists, stop for a manual account audit; do not automatically demote or edit any account. If the owner loses access, verify identity out of band, then run the documented `reset-password` action through the same reviewed operator process. There is no public password reset route. Use a short-lived secret-manager value for the reset and remove it afterward.

Frontend visibility is not authorization. A UI may show Admin navigation after an authenticated identity response, but every Admin API must enforce `requireAuth`, `requireRole('admin')`, and the fixed owner identity check on the server. The current `/api/v1/admin/me` response is only a way for a future frontend to confirm the authorized Admin identity; it does not establish access by itself.

### Proposed authorization rules for a future ticket workflow

These rules are design guidance, not implemented ticket authorization. Every route should run `requireAuth` followed by a role guard where appropriate and must still scope database queries to the actor's allowed records. A role check alone does not establish ticket ownership or assignment access.

| Operation | Customer (`user`, proposed) | IT (`it`, proposed) | Admin (`admin`) |
|---|---|---|---|
| List tickets | Own customer-created tickets only; ignore/reject caller-supplied creator filters that could widen scope. | Internal tickets assigned to the actor or in an explicitly authorized team queue. | All tickets within the authorized organization. |
| View ticket | Own ticket only; return customer-visible fields/comments. | Assigned ticket or internal ticket in an authorized queue/team. | Any authorized organization ticket. |
| Create ticket | Create only `source=customer`, `creatorId=actor`; assignment/status are server-controlled. | Create internal IT tickets only if product permits; source and creator are server-controlled. | Create either source if allowed by business workflow. |
| Assign/reassign | Not allowed. | Only if a separately approved IT-lead permission is defined; default proposal is no reassignment. | Allowed; validate assignee/team membership and record the change. |
| Change status | No direct status changes; optionally allow a narrowly defined customer response/reopen action. | Allowed on assigned/authorized internal tickets through a server-side state machine. | Allowed with the same state validation and override audit. |
| Comments/internal notes | Add/read customer-visible comments on own tickets; never read internal notes. | Read/write internal notes only on assigned/team-authorized tickets; customer-visible replies remain distinguishable. | Read/write both visibility levels on authorized tickets. |
| Recommendations | View only recommendations linked to own tickets and approved for customer visibility. | View/use recommendations on authorized internal tickets; approval powers require a separate policy. | Organization-level access and approval only if that workflow is explicitly defined. |
| Admin analytics | No organization-wide analytics. | No organization-wide analytics unless separately granted. | Organization-level aggregate analytics; avoid exposing unrelated customer-sensitive fields. |

For IT access, define an explicit team queue or membership relation before implementation. A ticket is accessible to IT only when it is assigned to that user or its queue/team is one the user is authorized to work. Do not treat every internal ticket as globally visible to every IT account. If assignment/team membership is not available, deny access by default. For customers, apply `creatorId = authenticatedUserId` in the database query itself and independently filter internal notes before serialization; never fetch broadly and rely on UI hiding.

## Proposed ticket contract (not implemented)

Keep this as a design proposal until the ticket workflow owner confirms lifecycle and authorization requirements. A future Ticket document should minimally include a unique human-readable `ticketNumber`; `creatorId` User reference; `source` enum (`customer`, `internal_it`); title and description; category; priority; lifecycle status; optional assignee/team references; created/updated timestamps; and nullable `resolvedAt`. Predicted hours/model version belong to prediction history, not to actual resolution fields. Actual elapsed resolution time should be derived from creation and resolution timestamps, not written from a prediction.

Candidate statuses are `open`, `in_progress`, `waiting_on_customer`, `resolved`, and `closed`. Confirm transitions before enforcing them; a reasonable initial graph is `open -> in_progress`, `in_progress -> waiting_on_customer|resolved`, `waiting_on_customer -> in_progress|resolved`, and `resolved -> closed|in_progress` (reopen), with actor permissions checked on each transition. Do not add a status enum until the product owner confirms these states.

Candidate indexes: unique `ticketNumber`; `{ creatorId, status, createdAt }` for customer lists; `{ assigneeId, status, updatedAt }` for assigned work; and `{ teamId, status, updatedAt }` only if team queue queries are adopted. Add indexes alongside measured queries and keep pagination bounded. Validate request bodies, ObjectId references, enum values, filter/sort allow-lists, and transitions with server-side schemas. Do not accept `creatorId`, `source`, role, assignment, or resolution fields from callers where the actor/workflow determines them.

Proposed API shapes should preserve the existing `{ success, data, message }` envelope. Ticket list responses should include `items`, `page`, `pageSize`, `total`, and `pages`; item serializers should expose only the caller's permitted fields. Create/view/update responses should use the same ticket serializer. Comment responses should make `visibility` explicit while withholding internal-note records entirely from Customer responses. Exact endpoints, filters, mutable fields, transition errors, and recommendation visibility still require product decisions.

## Proposed shared contract and scope decisions

Keep the current three collections as the foundation. No migration or seed is needed for this change, and existing data should remain untouched.

| Proposed entity | Decision | Contract when ticket workflow is implemented |
|---|---|---|
| User | Already exists; refine status/roles only with authorization integration | Name, normalized unique email, password hash, role, account status, timestamps. Public registration always creates the least-privileged customer role. |
| Ticket | Defer | Unique ticket number; creator reference; source `customer` or `internal_it`; title, description, category, priority, status; assignment references; created/updated/resolved timestamps. Keep predicted duration separate from actual resolution time. |
| Ticket comment | Defer until ticket routes/UI exist | Ticket and author references, message, visibility (`customer` or `internal`), creation timestamp. Internal notes must be filtered server-side for customer reads. |
| Assignment history | Defer until assignment workflow exists | Ticket, assigning admin, assignee and/or team refs, assignment change and timestamp fields. Use append-only events if product requirements need a complete history. |
| Resolution prediction history | Existing `Prediction` stores standalone estimates | When predictions are run against persisted tickets, add an optional validated ticket reference or a dedicated history model. Include prediction timestamp, hours, model version, and evaluation metadata; never substitute it for the actual outcome. |
| Teams and membership | Defer pending authorization policy and team workflow | Team identity and explicit membership/role relationships; do not infer team access from a client-supplied field. |
| AI recommendation and approval | Defer | Add only after product defines recommendation lifecycle, approver, state transitions, and immutable approval events. |
| Audit log | Defer until security-sensitive ticket/admin mutations exist | Append-only actor/action/resource/time record with carefully allow-listed metadata; never copy credentials, tokens, or full sensitive request bodies. |

Customer and internal IT tickets should share the core ticket shape with source-specific authorization and any category-specific fields kept explicit. Customer queries must be constrained to their creator reference. IT users should see only the internal tickets and assignments authorized by the agreed policy. Admin access must be enforced in service/middleware, not the UI. State transitions, assignment changes, and visibility changes need server-side validation. These policies require the corresponding ticket routes and role definitions before they can be tested or safely activated.

## API/data-contract guidance

- Continue the existing response envelope and authenticated session cookie.
- Validate body/query parameters with allow-listed Zod schemas; validate ObjectId route references before queries.
- Ticket list endpoints should use bounded pagination, allow-listed sort fields/directions, and indexed filters. Always scope the query by the caller's authorization before applying user filters.
- Use projections/serializers for public users and ticket responses; never return password hashes, session token hashes, or unapproved internal comment fields.
- A ticket create must persist successfully even if the ML service is unavailable. Record a prediction only after a successful model response; prediction failure should be represented independently from ticket creation.
- Do not put model binaries, training datasets, or fabricated resolution outcomes in MongoDB.

## Index and migration policy

Add indexes only alongside observed query patterns: unique ticket number; `{ creatorId, status, createdAt }`; and `{ assigneeId, status, updatedAt }` if assignee filtering/sorting is implemented. Confirm actual usage before adding compound indexes. Keep initialization repeatable and non-destructive. Use migrations for future schema/data changes; never reset shared or production data. Transactions are appropriate only for multi-document operations that must commit atomically and only when the Atlas deployment supports them.

## Verification status and dependencies

- The server's existing validation tests and TypeScript build pass (see task results). No MongoDB-backed model/API tests currently exist.
- Atlas connectivity was verified with a read-only ping; credentials and connection details were not printed.
- Ticket schema, API, authorization policy, and database tests depend on the ticket workflow and roles being defined with the teammate implementing that separate application/model task. The current repository supplies no such implementation to integrate against.

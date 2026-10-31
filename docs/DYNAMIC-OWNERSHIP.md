# Dynamic content and ownership integration

The game is prepared for both content generated from uploaded learning resources and ownership by individuals, teachers and institutions. The deployed preview still stores authored content and saves in the browser. Browser labels and imported JSON never authorize access to a school, class or another person’s resources.

## Implemented boundary

`validateChapterContent` accepts only version 1 of the `underlight-v1` template. It bounds size, depth, node count, text, indices and references, strips unknown fields and rejects dangerous object keys. It returns data only: no code, commands, script URLs or arbitrary scene execution. A content identity is an id plus an immutable revision. An imported draft is shown with objectives, expected configurations, explanations and source excerpts before activation. Changed content with the same id must increment its revision. A replacement chapter resets its own progress, preserves the original adventure and writes a local recovery copy.

`authorizeWorkspace` and `preparePublication` are pure policy functions intended for a trusted server service. They are tested with anonymous, learner, editor, cross-workspace, unreviewed-source, changed-source and stale-revision cases. A request cannot confer authorization by supplying an owner id: the authenticated principal and memberships must be constructed by server middleware. This policy is not a working authentication provider, database or browser security boundary.

A publish candidate must belong to the resolved workspace, match the expected draft revision, and bind every teaching source to an exact reviewed resource version and source unit. The unit’s text and locator must match. The return value is a validated candidate; persistence must use a transaction and a compare-and-swap on the draft revision. A successful validator call alone is not publication.

## Records and API contract

| Record | Required identity and rules |
| --- | --- |
| Workspace | UUID, type personal/class/institution, server-maintained membership roles. Personal work is an independent workspace, even for a learner enrolled in a school. |
| ResourceVersion | workspaceId, resourceId, version, original object checksum, MIME, upload status, reviewed status, immutable source units and exact locators. |
| LearningPackVersion | workspaceId, id, version, objectives, reviewed resource-version bindings, accessibility options and review record. |
| GameSpecVersion | workspaceId, id, revision, template `underlight-v1`, content schema, asset-manifest version, learning-pack version, source bindings and review record. |
| GameSession | workspaceId, learnerSubject, immutable game-spec identity, session revision, validated runtime state. One save cannot silently migrate to different content. |
| LearningObservation | workspaceId, learnerSubject, sessionId, objectiveId, attempt, correct, hinted, source/content versions. Distinct from XP and rewards. |

Proposed authenticated endpoints:

- `POST /workspaces/:id/resources/uploads`: authorize create, issue a narrowly scoped upload target; enforce MIME/size and quarantine before extraction.
- `POST /workspaces/:id/games/drafts`: authorize create, select reviewed resources and objectives, enqueue one idempotent generation job.
- `GET /workspaces/:id/jobs/:jobId`: owner/workspace-scoped progress and resumable job identity.
- `POST /workspaces/:id/games/:id/reviews`: authorize review, validate exact sources and expected draft revision, then transactionally publish an immutable version.
- `GET /workspaces/:id/games/:id/versions/:revision`: authorize read and return only that version’s permitted content and assets.
- `PUT /workspaces/:id/sessions/:sessionId`: require the learner’s identity or an explicitly authorized educator role; reject a stale `If-Match` revision; validate the session against its pinned content.
- `POST /workspaces/:id/games/:id/transfer`: require current owner and destination authorization. Copy or move in a transaction with an audit record and explicit resource-license/permission decisions. Changing a client-side workspaceId never transfers anything.

Use private object storage for originals and Postgres with full-text search plus pgvector, as in the Resource Library plan. Apply workspace filtering before retrieval as well as on every returned source. Cross-workspace material is available only through an explicit, separately reviewed sharing or licensing grant. Never seed the product with the owner’s private book archive.

## Muse Wonder generation adapter

The user’s model constraint remains **Muse Wonder**, with no silent substitution of Wonder Full or Spark. Before connecting live inference, verify the current official API model id, account entitlement, structured-output support and terms; the older planning identifier is `muse-wonder-1.0` and is not asserted here as a newly verified catalogue entry.

The worker receives the server-resolved workspace, reviewed source units, chosen learning objectives, fixed template schema and accessibility needs. It returns a draft GameSpec, never code. Persist the job id and input version/checksum before calling inference. Resume the same job after timeout, deduplicate completion, validate references and solvability, and keep the previous published version active if generation or review fails. Costs, retries and cancellation belong in the worker, not the game client.

Automatic checks should include bounded output, schema validation, source binding, every objective covered, valid route solutions, conservation of allocation totals, reachability of required rooms, one-time rewards and complete alternate endings. A human content reviewer must still check correctness, appropriateness and pedagogical fit before classroom publication. The current local review screen is a useful preview of that step, not proof that external source grounding or teacher identity has been established.

## Next implementation acceptance

1. Two real authenticated workspaces with a learner and educator; tests prove neither can enumerate or fetch the other’s resources, jobs or sessions.
2. Upload one permitted document, extract page/section source units, review it and retrieve only scoped units.
3. Generate a complete chapter with the verified Wonder API, retain its job record, validate it, review it and publish an immutable version.
4. Play that version, save and resume on another device with optimistic concurrency; verify a different subject using the same renderer.
5. Transfer or copy an authorized game between test workspaces, with explicit handling of resource ownership and an audit log. Existing learner sessions stay pinned to their original version.
6. Run an adversarial resource/prompt-injection review, accessibility review and retention/export/delete checks appropriate to the actual deployment before school rollout.

# Class overview dashboard: implementation plan

Status: built on 4 November 2026 as classes with join codes; see `docs/CLASSES.md`. This file keeps the original reasoning. Mockup: canvas "Mosaic Redesign — Lantern Light", page Teacher screens, board "Teacher — class overview".

## What a teacher should get from one screen

1. Which chapters are waiting for my review, and which are live for this class.
2. Who in the class has shared an update, and who asked for help.
3. New work and explanations learners chose to share, so I can respond.
4. Who hasn't joined yet or has had access withdrawn.

It must not grade or estimate mastery, and it must never turn "not shared" into "inactive". A leaderboard was added at the product owner's request on 4 November 2026: off by default per class, learner opt-in by nickname, steps this week only, visible only inside the class.

## What exists today (read in code)

| Need | Source today | Notes |
|---|---|---|
| Class membership | `pilot-member:<ref>` rows in `data_controls` (`server/pilot-access.js`) | No class entity. `group` is a free-text label (max 80 chars) copied from the invite. Roster query caps at 200 and returns policy JSON only. |
| Roles and who manages whom | `admission()` in `pilot-access.js:26-37`; `member.manager` | Teachers manage school-context learners they invited. |
| Assignments | `assignment:<hash>` rows (`pilot-access.js` `assign`) and course grants (`server/course-grants.js`) | No endpoint returns them as a set per class. |
| Per-learner progress a teacher may see | Shared course reports: `GET /api/learning/course-sharing?view=organiser` (`server/course-sharing-api.js:65-73`) | Opt-in per course. Each objective is `not-started`, `started` or `practised` plus `help: true/false`. Self-report, not evidence. Paged 20 at a time. `readSharedReport` returns `shared`, `off`, `expired` or `unavailable`. |
| Submitted work and feedback | `server/teacher-review.js` | Consent per submission. Feedback is `{strength, nextStep}`. Fetched one at a time; there is no list across learners. |
| Review queue | `workshop_jobs` via `GET /api/workshop/library` (`server/workshop-api.js:46`) | Status `review` means "waiting". Last 30 jobs, no paging, mixes the teacher's own drafts. |
| Activity timestamps | Shared report `updated`, submission `submittedAt`, membership `joined` | `retention_subjects.updated` and `data_events` exist but are retention and audit records. Using them for "active this week" would bypass learner consent. |
| Explanations ("explain it back") | `teachBack`, unit `reflection` in the learner's own NCB rows | Private. No sharing route exists. |

## Rules the dashboard must follow

- Game results and tiles are not mastery (`AGENTS.md`). "Practised" is a learner's self-report (`docs/COURSE-SHARING.md`).
- Sharing is off by default and per course. Withdrawal always wins, including mid-request.
- Missing, expired or unavailable reports are shown as "not shared", never as zero or inactive (`COURSE-SHARING.md:7`).
- Respect each learner's `progressDays` retention; expired reports disappear.
- No consequential auto-grading, ranking, attention or emotion analytics.
- Not an institution-wide analytics product: one teacher, their own learners.

## What the screen shows (honest version)

| Card or panel | Data | Phase |
|---|---|---|
| Waiting for your review (count + queue table) | `workshop_jobs` with `status='review'` created for this class's course, plus citation coverage from `publicJob` | 1 |
| Live for this class (count) | Published chapters assigned to learners in the group | 1 |
| Sharing updates (n of m learners) | Count of `readSharedReport` results with `state='shared'` | 1 |
| Asked for help (count + names) | Objectives with `help: true` in shared reports, with "Seen" acknowledgement | 1 (list), 2 (acknowledge) |
| Class mosaic | One tile per learner. Colour = their most recent shared objective status (started / practised). Grey hatched = not sharing. Dashed = invited, not joined. | 1 |
| New work to read | Consented submissions from `teacher-review` since the teacher last looked | 1 |
| New explanations to read | New opt-in "share my explanation" (see Phase 2) | 2 |
| Last shared update per learner | `updated` from the shared report, labelled "Last update shared", never "last active" | 1 |

Removed from the first mockup: "Active this week" and "steps taken this week". Neither has a consented source, and showing them would break the rules above.

## Phase 1: aggregate what already exists (about 3–4 days)

Server, one new read-only endpoint so the browser doesn't make dozens of slow calls:

`GET /api/learning/class-overview?group=<label>&cursor=<n>`

```json
{
  "group": "Year 8 History",
  "counts": {"learners": 28, "invited": 2, "sharing": 19, "helpRequested": 4, "reviewWaiting": 3, "live": 9, "newWork": 5},
  "learners": [{"ref": "…", "label": "Amelia H", "status": "active", "report": {"state": "shared", "updated": 1793750000000, "latest": "practised", "help": false}}],
  "review": [{"id": "job…", "title": "The river and the waiting light", "format": "adventure-v1", "sources": 6, "status": "review"}],
  "work": [{"assignmentId": "…", "learnerLabel": "Ben C", "submittedAt": 1793740000000}],
  "nextCursor": 20
}
```

- Auth: `access.manages`; only learners where `member.manager === owner` (admin may pass any group).
- Groups: `GET /api/learning/class-overview?view=groups` returns the teacher's distinct `group` labels with learner counts. Normalise labels (trim, case-fold for matching, keep the original for display).
- Roster: page 20 learners at a time (matches report paging). Fix the 200 cap by paging the `pilot-member:` query with `LIMIT/OFFSET` on `json_extract(policy,'$.manager')` and `$.group`.
- Reports: call the existing `readSharedReport` per active grant, never a new query on NCB data. Run at most 4 at a time; NCB calls were measured at about 1.7 s and return 429 under bursts. Cache each page server-side for 60 s keyed by teacher, group and page; invalidate on share, withdraw, revoke and reassign events.
- Review queue: add `?status=review&course=<id>&cursor=` to the workshop library, and exclude the teacher's private drafts that aren't linked to a class course.
- Work inbox: list `course-work:<id>` consent rows for this teacher's grants where `submittedAt` is after the teacher's last-viewed marker (store `class-seen:<owner>:<group>` in `data_controls`).
- Audit: write a content-free `class-overview-viewed` event (no learner data) to `data_events`.

Client: build `TeacherHome` from the canvas mockup under the Studio "Courses" tab for teachers (`canPrepare(client)`), with a group picker, the cards above, the class mosaic legend and "not shared" states.

Tests (`tests/class-overview.test.mjs`):
- A learner managed by another teacher never appears.
- `off`, `expired` and `unavailable` all render as "not shared" and are never counted as inactive.
- A withdrawal between page loads removes the learner's report on the next page.
- Paging returns every learner once across pages; no 200 cap.
- Concurrency stays at 4 or fewer simultaneous NCB reads.
- Counts never include the teacher's own private drafts.

## Phase 2: opt-in sharing learners control (about 4–5 days)

1. **Share my explanation.** On the "explain it back" step (canvas: Game screens › End of a game) add a per-explanation switch, off by default. On save, write a consent receipt like `teacher-review.js` does (`course-explanation:<grant>:<key>` in `data_controls`, token + version) and a copy of only that text to the learner's NCB report slot. The teacher sees text, chapter and time, and can reply with the existing `{strength, nextStep}` feedback or a marker note or sticker. Withdrawal deletes the shared copy.
2. **Acknowledge help requests.** `help-seen:<grant>:<objective>` with the teacher's time, so the learner sees "Ms Patel has seen this".
3. Optional, only if teachers ask for it after Phase 1: a learner-shared weekly summary ("I took 3 steps this week") shown to the learner before it is sent, as an extra field in the existing shared report. Don't derive it from retention or audit tables.

## Decisions needed

1. Are classes just the free-text group label (Phase 1 assumes yes), or do we add a proper class record with a name, code and co-teachers?
2. Do we want the "share my explanation" flow in Phase 2?
3. Is "Last update shared" an acceptable stand-in for activity, given we will not track activity without consent?

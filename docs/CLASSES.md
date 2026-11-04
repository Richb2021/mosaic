# Classes, join codes, leaderboards and shared explanations

Added 4 November 2026 on branch `redesign/lantern-light`. Backend: `server/classes-api.js` (route `/api/learning/classes`). Studio UI: `src/studio/Classes.jsx`. Tests: `tests/classes.test.mjs`.

## What it does

- **Classes per teacher.** Teachers, guardians and administrators create classes (up to 50 each). Each class has a 6-character join code (no 0/O/1/I/L), which the teacher can copy, replace, or stop by archiving the class. Deleting a class removes its members, leaderboard and shared explanations.
- **Joining.** Any admitted learner types the code in Me › Classes (up to 20 classes each). Learners never see the code after joining. Leaving a class removes everything they shared with it.
- **Class overview** (Studio › Classes, teachers only): learners (20 per page), last update shared, latest shared course status, help requests, explanations to read, chapters waiting for review, and the leaderboard.
- **Leaderboard.** Off by default; the teacher turns it on per class. Learners opt in with a nickname (2–20 letters or numbers). It shows nicknames and the steps each learner finished this week (counted on their device, sent only after opting in), resets every Monday (UTC), and is visible only to that class and its teacher.
- **Shared explanations.** From the Trail, a learner can share one "explain it back" text with a class after previewing it. The teacher replies with what worked, an optional next step and an optional sticker. Stopping sharing removes the copy straight away.

- **Assign a course to a whole class** (Courses › a ready course › *Or assign to a whole class*; server action `assign-class` in `server/course-sharing-api.js`). Every active member gets the same reviewed version, activities, instructions and due date, 25 per request, and the teacher sees who was assigned, who already had that version and who was skipped and why.
  - Learners in the teacher's own group get an ordinary course grant.
  - Self-directed adults (individual context, organised by someone else) get a **class grant**: it records `classId` and a binding to their membership, and `activeCourseGrant` accepts it only while they remain in that class. Leaving, removal or deleting the class revokes it; rejoining does not revive it.
  - Learners whose access a school or family arranged through another organiser are skipped ("Managed elsewhere"), so a class code can't route content to someone else's managed learner. The administrator can move them into the teacher's group.
  - The class overview labels each learner "Joined by code" or "Managed elsewhere"; learners see "From your class · NAME" on the course. Teachers still never receive a class learner's account reference.
- **Invite into a class, in bulk** (Welcome › Invite). One to 30 emails, one per line, each with its own private link (no email is sent). An optional class is joined when the invitation is accepted, so the learner is in the teacher's group and the class at once.

## Rules this follows

- Only learner-chosen data reaches the teacher: shared course reports (existing consent flow), shared explanations, and opted-in leaderboard steps. "Last update shared" is the only activity signal; not sharing is shown as "Not shared yet", never as inactive.
- Steps on the leaderboard count effort, not attainment. The UI says so wherever the leaderboard appears.
- Account data deletion removes class membership, leaderboard rows and shared explanations, plus any classes the person owns (`deleteClassData`, called from `server/data-lifecycle.js`).
- Audit events are content-free: `class-created`, `class-joined`, `class-left`, `class-deleted`, `explanation-shared`, `explanation-unshared`, `feedback-sent`, `class-overview-viewed`.

## Safeguards (after independent review, 4 November 2026)

- **Withdrawal always wins.** Leaving a class, stopping sharing and leaving the leaderboard work in archived classes, before re-accepting an updated notice, and for withdrawn (`revoked`/`closing`) accounts (`WITHDRAWAL_ACTIONS` in `server/learning-api.js`). Archived classes stay listed for learners, read-only.
- **No account references to teachers.** The overview uses a per-class handle (`sha256('class-handle:'+classId+':'+learner)`, 32 hex); remove and feedback take that handle.
- **Organiser changes.** Revoking a learner or transferring them to another organiser removes them (and anything they shared) from the previous organiser's classes.
- **Join codes.** Uniform random codes; 10 wrong codes per learner per hour, then a 429. Replacing a code swaps it in with a compare-and-set and removes the old code; deleting a class removes every code that points at it.
- **Leaderboard data** is accepted only while the leaderboard is on; turning it off deletes nicknames and steps. Leaderboard activity never counts as "last update shared".
- **Your data.** Export includes class memberships, leaderboard entries, shared explanations (with feedback) and classes you teach. The deletion preview counts class rows. Shared explanations and leaderboard rows follow the learner's progress-retention setting.
- **Counts.** Course-report counts (sharing, help) are worked out per page of 20 and labelled "this page" when a class has more learners.

- **Leaderboard fixes (4 November, after the grokcc/muse gap review).** Only steps reported this week are ranked; an opted-in learner with no report this week is listed as "Not reported yet this week", never as zero. A device can only raise this week's total, so a second device starting at zero cannot wipe it. Steps are posted to every class the learner opted into. The teacher sees every opted-in learner; learners see the top ten plus themselves.
- **Overview accuracy.** Course reports read all of a learner's grants from this teacher (up to the 24-grant cap), newest first. The review queue is the teacher's own drafts across all classes and is labelled that way (`reviewScope:'workshop'`); the unused class-wide "live" count was removed.

## Storage

All rows live in `data_controls` (SQLite on Baldur, D1 in the Worker build); no migration is needed.

| Scope | Holds |
|---|---|
| `class:<id>` | name, code, owner, siteOwner, teacher label, archived, leaderboard on/off |
| `class-code:<CODE>` | class id |
| `class-member:<id>:<learner>` | display label (first name + initial), joined, status |
| `class-board:<id>:<learner>` | opt-in, nickname, week, steps |
| `class-share:<id>:<learner>:<key>` | title, explanation text (≤1200 chars), shared time, teacher feedback |

## Not yet included

Co-teachers and moving learners between classes. A learner managed by another school or family organiser can join a class and share explanations, but class assignments skip them until the administrator moves them to this teacher's group.

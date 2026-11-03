# Explore lessons and richer formative assessment

Open **Learning studio → My learning → Open Explore lessons** from a saved programme. An adult author chooses an existing reviewed activity as the focus. Muse Wonder (`muse-wonder-1.0`, Standard) receives that activity's exact source passages and the programme's goal, stage, level, interests, difficulties, study context, exam context, time and accessibility preferences. These are learner choices, not fixed learning styles or formal ability classifications.

## Authoring and review

A lesson is one resumable creative-generation job. It contains 2–5 investigations and 3–6 assessment tasks, with at least two assessment formats. The model selects from authored components; it cannot supply code, geometry, arbitrary equations or external assets. Exact source references, bounds, identities, canonical passages and a 24 KB assignment-snapshot limit are validated on the server. Validation is not factual review.

The author can edit wording, parameters, reviewed answers and criteria without using AI allowance. All edits require approval of the exact new hash. Review must check subject claims, units, examples, analogies and the model's limitations. Preview does not write learner progress. Saved requests resume using their existing provider ID; a validation failure never silently launches a replacement.

## Supported interaction

| Component | Authored behaviour | Boundaries |
| --- | --- | --- |
| Experiment | Change a total and percentage; compare allocated amount and remainder | Fixed arithmetic balance model, not a scientific simulator |
| Graph explorer | Change input and rate; inspect the line, current result and data table | Linear `y = rate × input + initial` only |
| Timeline | Select ordered events and read their evidence | Reviewed chronological or explicitly stated sequence |
| Connection map | Numbered relationship overview plus complete text relationships | Links state reviewed relationships, not automatically proven causation |
| Annotated model | Select concept parts to reveal explanations | Concept layout, not physical anatomy or generated geometry |
| Worked example | Reveal reviewed steps in order | Explanatory content; not an unseen assessment |
| Evidence sorter | Classify each item and compare after saving | Two reviewed categories; answer fields withheld until submission |

Learners write predictions and observations. The first saved investigation preserves its settings and classification. Predictions are reflection notes, not proof of an unaided attempt; explanatory materials and source reading remain available.

## Assessment

* **Short answer:** reviewed accepted terms; normalization of spacing/case and duplicate alternatives. Other valid wording may require human review. No semantic grading claim.
* **Numerical reasoning:** finite decimal input, absolute tolerance and a separate, explicitly requested unit. Invalid number syntax or an incorrect/missing unit is rejected before the first response is stored.
* **Worked solution:** written working plus a checked final numerical result. Matching the final value does not validate the reasoning.
* **Rubric-guided writing:** learner explanation, explicit criteria, self-checks and reviewed improvement guidance. No automatic essay score or inferred quality grade.

Each first response, confidence and clue-before-answer flag is saved. Original answers cannot be overwritten. An author who reviewed the answer key is told their practice is not unseen. Completion, confidence and self-checks are not mastery estimates. New Explore records do not silently change existing spaced-review rules or teacher reporting consent.

## Ownership, assignment and lifecycle

`server/explore-api.js` resolves either the owner's exact published lesson or an active immutable course-assignment snapshot. It requires the same canonical chapter and a matching saved programme focus. Existing course grant leases, source checks and withdrawal rules apply. The existing attachment contract supports **one reviewed learning activity per objective**: a four-question learning cycle or an Explore lesson. It does not yet attach both simultaneously.

Learner state uses the existing NoCodeBackend `learner_profiles` table, in an owner-scoped `explore-` slot derived from lesson ID and hash. Writes use compare-and-swap versions. A conflict cannot silently replace a saved reflection: the learner chooses the saved reflection or their retained draft. Saved answers are shown as readable text, independent of disabled editors.

Records participate in the existing account export, learner deletion and progress-retention controls. Source or lesson withdrawal removes future assigned access without silently deleting a learner's historical record. No new tables or migrations are introduced. Generation uses the existing allowance, budget and cost ledger; review edits and practice saves do not use generation allowance.

## Verification evidence

Project evidence is in `output/explore-assessment/` at the workspace root, with an independent audit and its disposition, full test/build logs, real Muse provider/job IDs, three source-reviewed topic/profile artifacts, real NoCodeBackend save/export checks, and browser screenshots and checks. The three fixtures use synthetic primary/secondary/college profiles in a disposable adult test identity. They do not establish real-child usability, all-subject suitability or accessibility conformance.

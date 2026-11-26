# Results and graduation eligibility

Branch and Super Admins configure each cohort's minimum attendance percentage,
minimum assessment average, and at least one required published assessment.
Required assessments must belong to the cohort or to its assigned curriculum
version. Assigned Instructors can review results but cannot change requirements
or finalize them. Students cannot access these staff reports.

Attendance uses completed sessions on or after enrollment in the branch's
timezone. Present and late count as attended; excused sessions are excluded.
Unrecorded attendance counts in the denominator. Without an applicable session
in the denominator, attendance is unavailable.

For each required assessment, the latest submitted or timed-out attempt with a
valid stored score is used. Assessment percentages are averaged equally, not
weighted by points. The unrounded percentages are compared with the configured
minimums. Eligibility is incomplete when attendance or a required assessment is
unavailable; otherwise it is eligible only when both minimums are met. Curriculum
activity completion is not tracked or included in this phase.

The live report can change as attendance, attempts, or requirements change.
Finalization explicitly creates an additional historical snapshot, including the
requirements, student details, scores, reasons, and the finalizing user. Previous
snapshots are retained when a report is finalized again.

All routes below are under `/api/cohorts/<cohort_id>/`:

- `GET`, `PUT` `graduation-requirements/`: read or configure requirements.
- `GET` `results/`: live cohort report.
- `GET` `results/students/<student_id>/`: individual performance summary.
- `POST` `results/finalize/`: create a historical snapshot.
- `GET` `results/history/`: retrieve finalized snapshots.

The frontend currently uses browser-local mock data rather than these Django
endpoints. Existing demo enrollments without enrollment dates are treated as
having enrolled before all recorded sessions; new demo enrollments record a
branch-local enrollment date.
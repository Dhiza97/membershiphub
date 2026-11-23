---
version: 1
slug: "frontend-src-app-jsx"
primary_target: "frontend/src/App.jsx"
related_targets: []
---

# MembershipHub admin

## Scope
Operate authenticated Branch Admin and Super Admin workflows for branches, people, cohorts, and branch-owned curriculum versions.

## Audience
Branch Admins prepare branch-scoped cohorts and manage their branch's curricula; Super Admins oversee branches and accounts. The primary task is to organize and confirm a ready-to-run cohort with an immutable curriculum snapshot.

## Direction contract
THESIS: A fixed-cell status board makes cohort ownership, dates, instructors, and readiness immediately comparable.
OWN-WORLD: Ink table cells, clean white surfaces, MembershipHub purple for active navigation, yellow for live status, and a consistent fixed-column grid.
STORY: An administrator scans the branch board, opens a cohort, completes details, assigns one instructor, selects a published branch curriculum, enrolls existing students, and confirms readiness.
FIRST VIEWPORT: Branch navigation anchors the left; a compact page header and filters sit above a dense sortable cohort board; the primary create action stays visible at the heading.
FORM: Membership Status Board, selected challenger, Impeccable seed b987710e, source signals-instruments-split-flap-concourse.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Constraints
Use local mock API data for now. Curricula are branch-owned; edits start as the next draft version and published versions are immutable. Cohorts capture the selected published version when marked Ready. Enroll existing students only. Preserve role and branch restrictions, support keyboard and mobile layouts, and never imply mock actions were persisted to Django.

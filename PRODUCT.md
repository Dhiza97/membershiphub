# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

React with Vite on the frontend; Python with Django and Django REST Framework on the backend; PostgreSQL. The frontend and backend remain separate applications.

## Users

The primary first user is a Branch Admin responsible for membership classes within an assigned church branch. Other intended users are Super Admin, Instructor, and Student roles.

Every newly created user starts as a Student. A Super Admin is the only role that may assign or change a user's role to Branch Admin. Branch Admin assignment must include the user's assigned branch and must be enforced on the backend.

## Product Purpose

MembershipHub centrally manages church membership classes across multiple branches while allowing each branch to run cohorts and manage students, instructors, sessions, attendance, assessments, and results.

The first successful workflow is for a Branch Admin to establish a ready-to-run cohort: create the cohort, assign an instructor, and register or enroll students in the branch.

## Positioning

MembershipHub combines organization-wide oversight with branch-level operations in one system, while preserving branch data isolation and historical cohort records.

## Operating Context

- One organization with multiple branches.
- A branch runs multiple cohorts over time.
- A cohort contains students and sessions.
- Attendance is recorded against individual sessions.
- Curriculum changes must not silently alter the requirements of ongoing or completed cohorts.
- The initial implementation status is setup and backend foundation work; the current frontend is still a Vite starter screen.
- Cohort creation is a repeatable administrative workflow performed by a Branch Admin within their assigned branch.

## Capabilities and Constraints

Confirmed capabilities include branch, cohort, student, instructor, enrollment, session, attendance, assessment, result, graduation, certificate, reporting, and historical cohort management.

Hard constraints:

- New users default to the Student application role.
- Only a Super Admin can assign or change a Branch Admin role.
- A Branch Admin belongs to one assigned branch under the current role model.
- Branch Admin access is limited to records belonging to the assigned branch.
- Backend querysets, services, and permission checks must enforce branch isolation.
- Frontend filtering is not a security boundary.
- Super Admin access may span branches.
- Curriculum versioning or cohort-specific snapshots are required to preserve class requirements.
- Which curriculum fields are centrally locked versus branch-editable remains undecided.

## Core Workflow: Create Cohort

The first priority workflow is enabling a Branch Admin to create a cohort that is fully prepared to run.

### Primary Outcome

A successfully confirmed cohort must have:

- Complete cohort details.
- Exactly one assigned instructor.
- A registered and enrolled student roster.
- Explicit administrative confirmation.
- An initial status of `Ready`.

### Workflow Structure

Cohort creation uses a persistent four-step setup experience.

**Step 1: Cohort Details**

Required information:

- Cohort name.
- Description.
- Start date.
- End date.
- Assigned branch, displayed read-only.

The branch is inherited from the Branch Admin's assigned branch. It must never become an editable branch selector.

**Step 2: Instructor**

- Display searchable, branch-approved instructors.
- Allow selection of exactly one instructor.
- Show an assignment preview.
- Allow the selected instructor to be removed or replaced.
- Provide appropriate empty and no-results states.

An instructor must be assigned before the cohort can be confirmed.

**Step 3: Students**

- Search existing students belonging to the assigned branch.
- Register missing students through an inline form or small drawer.
- Automatically enroll newly registered students in the cohort.
- Allow existing students to be enrolled.
- Display an editable roster with individual removal actions.
- Display the current student count.
- Keep required registration fields visible.

Duplicate detection:

- Check both email addresses and phone numbers against existing student records.
- Normalize identifiers before comparison.
- Prevent accidental duplicate student registration.
- If an identifier matches an existing student, surface the existing record for resolution.
- If email and phone match different student records, require manual resolution rather than automatically creating another profile.

Registering a student creates their student profile. Account activation and login may happen separately.

**Step 4: Review and Confirm**

Display a review of:

- Cohort details.
- Assigned instructor.
- Enrolled student roster.
- Student count.
- Readiness checklist.

Confirmation must remain blocked while required information is incomplete.

On successful confirmation:

1. Create the cohort.
2. Assign its initial status as `Ready`.
3. Preserve its instructor assignment and student enrollments.
4. Open the newly created cohort's detail workspace.

The `Ready` status means setup is complete and the cohort is prepared to begin. It does not mean that teaching has started.

### Navigation and Interface Structure

- Use a restrained application shell with branch context and section navigation.
- Maintain a left-side four-step progress indicator on desktop.
- Keep completed steps accessible.
- Preserve entered values when navigating between steps.
- Provide a fixed bottom action bar containing Back, Save Draft, and Continue.
- Use labeled summary sections on the review screen rather than dashboard-style card stacks.

### Draft Management

- Allow saving an incomplete cohort as a draft.
- Preserve entered values when navigating between steps.
- Support recovery of an existing unsaved draft.
- Preserve user-entered values when network saves fail.
- Prevent duplicate cohort creation through repeated confirmation attempts.

### Validation and Feedback

- Validate fields on blur.
- Summarize blocking errors on submission.
- Provide inline loading states or skeleton content.
- Clearly identify invalid or reversed date ranges.
- Provide feedback for registration, enrollment, assignment, saving, and confirmation failures.
- Do not discard entered values after an API or network failure.

### Accessibility and Responsiveness

- Support keyboard navigation and visible focus states.
- Respect reduced-motion preferences.
- Use single-column forms on mobile.
- Provide condensed or horizontal progress navigation on smaller screens.
- Use full-width primary actions on mobile.
- Ensure required information and confirmation criteria remain accessible at every screen size.

### Important Edge Cases

The workflow must account for:

- Existing unsaved drafts.
- Missing, stale, or unavailable branch assignments.
- Instructors becoming unavailable or being removed.
- Duplicate student registration.
- Registration API failures.
- Partially loaded student rosters.
- Invalid or reversed dates.
- Network failures during draft saving.
- Cohort name collisions.
- Permission changes while the workflow is open.
- Repeated confirmation attempts.
- Loss of session context.

### Initial Scope Exclusions

The initial Create Cohort workflow does not require:

- Cohort capacity configuration.
- Curriculum selection or customization.
- Student account activation.
- Automatic cohort activation or class commencement.

These may be addressed in separate workflows.

## Brand Commitments

The product name is MembershipHub. No existing logo, visual identity, palette, typography, voice guide, or binding visual assets were found in the repository.

The interface direction is professional education-management SaaS:

- Restrained neutral surfaces.
- One clear accent color for selected states and primary actions.
- One sans-serif font family with a consistent typographic scale.
- Strong form labels and familiar controls.
- Dense but readable administrative interfaces.
- No decorative imagery or oversized marketing-style headers.

## Evidence on Hand

- Repository guide: Agent.md
- Django custom user model and migration setup.
- Django and Django REST Framework backend foundation.
- React with Vite frontend scaffold.
- PostgreSQL database setup documented in Agent.md.

No implementation evidence for brand assets, user testimonials, case studies, or production metrics was found.

## Product Principles

- Branch work must remain scoped to the assigned branch.
- Real workflows should model cohorts, sessions, enrollments, attendance, and results explicitly.
- Historical records should remain meaningful when curriculum requirements change.
- Central oversight must not weaken branch-level data isolation.
- Interfaces should support repeated operational tasks for administrators and instructors.
- Administrative actions that change important records should be explicit and traceable.
- Required workflow conditions must be enforced by the backend, not merely by frontend validation.
- Drafts and partially completed administrative work should not be lost unnecessarily.

## Accessibility & Inclusion

No product-specific accessibility standard or mandatory localized language is confirmed.

The Create Cohort interface should support keyboard navigation, visible focus indicators, reduced motion, responsive layouts, and clear validation feedback.

The user will determine whether a formal accessibility standard or additional localization requirements are necessary.

## Colors
Primary color: #94007e
Secondary: #090909 & #fffeff
others: #ffce0b

## Curriculum Ownership and History

- Curricula are branch-owned and created from scratch by Branch Admins within their assigned branch; there is no organization-wide baseline in the initial implementation.
- A curriculum contains ordered topics, learning objectives, lessons, branch notes, and external-link learning materials.
- Editing a published curriculum begins a new draft version cloned from the latest published version. Published versions are immutable.
- Cohorts may use only a published curriculum version from their own branch.
- Marking a cohort Ready captures a curriculum snapshot. Subsequent curriculum edits or versions must not change that cohort's requirements or its historical curriculum record.
- Learning materials are external URLs in the initial implementation; file uploads are not included.
---
name: MembershipHub
description: Branch-centered administration for people and membership cohorts.
colors:
  hub-purple: "#94007e"
  hub-purple-dark: "#720061"
  hub-ink: "#090909"
  hub-paper: "#fffeff"
  hub-canvas: "#f5f3f6"
  hub-yellow: "#ffce0b"
  hub-line: "#e6e2e7"
  hub-muted: "#716b73"
typography:
  body:
    fontFamily: 'Aptos, "Segoe UI", ui-sans-serif, system-ui, sans-serif'
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
  heading:
    fontFamily: 'Aptos, "Segoe UI", ui-sans-serif, system-ui, sans-serif'
    fontSize: "24px"
    fontWeight: 600
    lineHeight: 1.2
  label:
    fontFamily: 'Aptos, "Segoe UI", ui-sans-serif, system-ui, sans-serif'
    fontSize: "12px"
    fontWeight: 600
    lineHeight: 1.2
rounded:
  none: "0px"
  full: "9999px"
components:
  button-primary:
    backgroundColor: "{colors.hub-purple}"
    textColor: "{colors.hub-paper}"
    rounded: "{rounded.none}"
    padding: "0 16px"
    height: "44px"
  button-secondary:
    backgroundColor: "{colors.hub-paper}"
    textColor: "{colors.hub-ink}"
    rounded: "{rounded.none}"
    padding: "0 12px"
    height: "40px"
  input-default:
    backgroundColor: "{colors.hub-paper}"
    textColor: "{colors.hub-ink}"
    rounded: "{rounded.none}"
    padding: "0 12px"
    height: "44px"
  navigation-active:
    backgroundColor: "{colors.hub-purple}"
    textColor: "{colors.hub-paper}"
    rounded: "{rounded.none}"
    padding: "0 12px"
    height: "40px"
  status-ready:
    backgroundColor: "{colors.hub-yellow}"
    textColor: "{colors.hub-ink}"
    rounded: "{rounded.none}"
    padding: "4px 10px"
---

# Design System: MembershipHub

## Overview

**Creative North Star: "The Branch Register"**

MembershipHub is a crisp, operational workspace for administrators who move between branch records, people, and cohort rosters. Its interface is built around a stable status board: fixed columns keep branch ownership, instructor assignment, dates, roster size, and lifecycle state comparable without hiding the next action.

The system favors ruled white working surfaces over floating panels. Ink headers establish the table structure, purple marks the current action and location, and yellow is reserved for Ready state. The same compact sans-serif voice carries headings, labels, and records so the work stays legible at administrative density.

**Key Characteristics:**
- Fixed-column data boards with clear row ownership.
- Square controls and one-pixel dividers.
- Purple for active navigation and primary actions; yellow for Ready.
- Mobile layouts convert tables into stacked, tappable records.

## Colors

The palette pairs a saturated membership purple with near-black ink, a clean white surface, a pale neutral canvas, and a high-visibility yellow status.

### Primary
- **Membership Purple** (`#94007e`): Primary actions, selected navigation, focus-adjacent emphasis, and interactive text.
- **Deep Membership Purple** (`#720061`): Hover state for primary actions.

### Secondary
- **Readiness Yellow** (`#ffce0b`): Ready status only; it is a semantic signal, not a decorative highlight.

### Neutral
- **Working Ink** (`#090909`): Table headers, primary text, and strong structural controls.
- **Paper White** (`#fffeff`): Tables, inputs, and working surfaces.
- **Canvas Gray** (`#f5f3f6`): Page background around working surfaces.
- **Rule Gray** (`#e6e2e7`): Dividers, field borders, and table rules.
- **Muted Ink** (`#716b73`): Supporting labels, metadata, and secondary actions.

**The State-Color Rule.** Color communicates action or cohort state. Do not use the Ready yellow as general decoration.

## Typography

**Display Font:** Aptos, with Segoe UI and system sans-serif fallbacks  
**Body Font:** Aptos, with Segoe UI and system sans-serif fallbacks  
**Label/Mono Font:** No separate label face; labels use the body family.

**Character:** A single compact, neutral sans-serif keeps names, controls, and records in one voice. Contrast comes from weight and size, not a separate display face.

### Hierarchy
- **Headline** (600, 24px, 1.2): Screen titles such as Cohorts and People.
- **Title** (600, 16px, 1.25): Section headings and cohort names.
- **Body** (400, 14px, 1.5): Forms, navigation, descriptions, and records.
- **Label** (600, 12px, 1.2): Field labels and compact metadata; uppercase only for table column headers and small status context.

## Layout

At desktop widths, a 236px navigation rail sits beside a flexible work area. The content is capped at 1500px; dense tables use stable column tracks, tabular counts, and fixed headers. The page header remains available while content scrolls. On small screens, the rail becomes horizontal navigation and table rows become full-width stacked buttons; forms move to a single column. Controls keep a minimum 40px height, with primary actions at 44px.

Spacing follows a compact administrative rhythm: related controls sit close, while sections are separated by a larger vertical interval. The cohort wizard uses a four-step progress rail on desktop and a two-column step selector on narrow screens.

## Elevation & Depth

The system is flat and ruled. Page canvas, white work surfaces, ink table headers, and one-pixel borders establish depth; shadows are not used to separate ordinary content. A subtle shadow is reserved for transient feedback only.

**The Ruled-Surface Rule.** Prefer a divider or tonal change over a floating card.

## Shapes

Buttons, fields, tables, and navigation use square corners (0px radius). Status and avatar markers may be circular where their shape carries meaning. Borders are thin and neutral; active navigation uses a solid rectangular field rather than a pill.

## Components

### Buttons
- **Shape:** Square corners (0px).
- **Primary:** Membership Purple with white text; 44px minimum height and 16px horizontal padding.
- **Secondary:** White surface with ink text and a neutral rule; 40px minimum height.
- **Hover / Focus:** Primary deepens to Deep Membership Purple. Keyboard focus uses a visible 3px yellow outline with a 3px offset.

### Chips
- **Style:** Compact rectangular labels with a small status lamp.
- **State:** Ready uses yellow with ink text; Active uses purple with white text; Draft, Completed, and Archived use restrained neutral or success colors.

### Cards / Containers
- **Corner Style:** Square (0px); use framed containers only for repeated records or task groupings.
- **Background:** Paper White against Canvas Gray.
- **Shadow Strategy:** None for static sections; borders and tonal contrast carry separation.
- **Border:** One-pixel Rule Gray.
- **Internal Padding:** 12–20px depending on record density.

### Inputs / Fields
- **Style:** White fill, one-pixel Rule Gray border, square corners, 44px minimum height.
- **Focus:** Membership Purple border with a faint purple ring; global keyboard focus remains a yellow outline.
- **Error / Disabled:** Errors use a pale red field and explicit recovery copy; disabled controls retain their layout and reduce contrast.

### Navigation
- **Desktop:** Fixed white rail with a purple rectangular active row and an organization or branch context label.
- **Mobile:** Horizontally scrollable row of compact text-and-icon actions.
- **Account context:** Current role and identity remain in the rail on desktop; the mobile header keeps a compact sign-out action.

### Status Board
- **Character:** Fixed columns keep cohort, branch where authorized, instructor, student count, dates, and status aligned for comparison.
- **Responsive behavior:** Rows become tappable summaries on mobile; filters remain available above the list.

## Do's and Don'ts

### Do:
- **Do** keep branch ownership visible whenever a Super Admin views cross-branch records.
- **Do** preserve fixed column meaning across cohort and account tables.
- **Do** use color as a state or action signal, with Ready reserved for yellow.
- **Do** keep mobile rows readable and operable without horizontal scrolling.

### Don't:
- **Don't** use frontend filtering as a substitute for backend branch authorization.
- **Don't** mark a cohort Ready before its details, instructor, and student roster are complete.
- **Don't** put informational sections inside nested floating cards.
- **Don't** present local demo changes as if they were saved to Django.
# CloudTask Pro

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary users are Vietnamese university students and small project teams of 2–10 members collaborating on coursework, assignments, and software projects. Individuals managing personal tasks are a secondary audience.

Prioritize simple onboarding, fast task management, and effective team collaboration.

## Product Purpose

CloudTask Pro brings personal tasks, shared projects, progress tracking, and deadline reminders into one application. It is developed for a cloud-computing course project and supports both individual work and team collaboration.

Success means users can quickly create, assign, track, and complete tasks with minimal friction.

## Positioning

The product combines Vietnamese task management, workspace roles, realtime collaboration, and server-side deadline automation for student teams. This is the established product mechanism; no unique market advantage or competitive superiority has been established.

## Operating Context

- Users sign in through Clerk, then work in shared workspaces and projects or switch to their personal task list.
- The team workflow moves from workspace selection and project overview to a project's Kanban board, task assignment, progress updates, subtasks, and comments.
- Workspace invitations and membership roles govern collaboration. User-facing roles are Chủ sở hữu (owner), Quản trị viên (admin), Thành viên (member), and Người xem (viewer).
- Personal tasks and project tasks have separate workflows and stored status values. Preserve their current behavior and terminology mappings.
- Notifications, automation statistics, and restricted automation history provide visibility into deadline processing. Deadline automation runs on the backend independently of an open browser.
- Desktop and mobile browsers are both supported usage contexts. Mobile web remains part of the web product.

## Capabilities and Constraints

Existing capabilities documented in README.md and represented in the frontend include:

- Personal task creation, editing, search, status filtering, priority, and due dates.
- Workspace and project management with project overview and progress information.
- Project Kanban with status changes through drag and drop or explicit controls, assignment, priorities, and deadlines.
- Team invitations, membership management, and role-based access.
- Subtasks, task comments, activity history, and notifications.
- Deadline automation, automation reporting, and access-restricted system history.
- Profile editing and avatar management.

Requirements confirmed by the user:

- Preserve React, Vite, TypeScript, Convex, Clerk, and Vercel architecture.
- Preserve existing features and business logic. Do not alter backend logic unless explicitly requested.
- Maintain realtime synchronization, reliable workspace role-based permissions, secure authentication, and fast performance.
- Permissions must remain enforced on the server; interface visibility does not replace authorization.
- Preserve Vietnamese as the primary language, including clear action labels, status messages, and understandable errors.
- Keep desktop and mobile workflows responsive and straightforward.
- Preserve internal API and stored enum values when refining Vietnamese presentation labels; src/lib/uiText.ts holds shared terminology and formatting.

Product performance targets and a formal production acceptance checklist remain open decisions. Do not claim measured speed, complete test coverage, or production readiness without new evidence.

## Brand Commitments

The existing product name is CloudTask Pro. Vietnamese is the primary product language.

User-confirmed interface commitments are clear visual hierarchy, consistent design tokens, and light, modern SaaS styling. Preserve these commitments without treating this product record as a palette, typography, or component specification.

## Evidence on Hand

- README.md documents course-project purpose, architecture, capabilities, development commands, deployment notes, and a proposed demonstration workflow.
- src/App.tsx implements the app shell, sign-in entry, personal tasks, and navigation to workspace and profile views.
- src/features/workspaces/ contains workspace, project overview, invitation, and membership interfaces.
- src/features/kanban/ contains project tasks, subtasks, comments, notifications, and automation interfaces.
- src/features/profile/ contains profile and avatar interfaces; src/lib/ contains Vietnamese localization and shared wording.
- Existing styles and components are the incumbent implementation. Their presence does not imply they have been audited for accessibility or responsiveness.
- README.md records preview demonstration checks and limited automated testing, and flags production authentication as not accepted as of 28 October 2026. These are historical repository reports, not checks performed by init; verify again before using them as current deployment claims.

No customer testimonials, adoption figures, competitive benchmarks, or commercial claims were established during init. Do not invent them.

## Product Principles

1. Reduce the steps needed to create, assign, track, and finish a task.
2. Make team responsibilities, task progress, and deadlines understandable at a glance.
3. Keep Vietnamese language and terminology consistent across personal and team workflows.
4. Preserve trustworthy collaboration through realtime updates, secure authentication, and role-based access.
5. Improve the interface within the existing architecture while preserving working features and business behavior.

## Accessibility & Inclusion

Accessibility and responsive use on desktop and mobile are explicit requirements. Preserve usable keyboard interaction, meaningful control labels, readable content, and understandable loading, empty, success, and error states. Kanban status changes must remain available through explicit controls as well as drag and drop.

A specific accessibility conformance level and any assistive-technology test matrix have not yet been chosen. Do not claim compliance without verification.

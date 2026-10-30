# CloudTask Pro regression verification

Date: 29 October 2026. Scope: current working tree after H1, H2, H3, and H4. PRODUCT.md and DESIGN.md were read; tracked diffs and the new modal, error-boundary, stylesheet, and UI test files were inspected.

The required commands passed. One reproducible tablet usability failure and one documentation mismatch remain. No application source, backend, authentication, permissions, or deployment configuration was modified during this verification.

## Evidence and limits

Three evidence levels are kept separate:

1. Existing automated suites: Vitest with convex-test, and Playwright fixtures importing the actual shared components and application CSS.
2. Additional screen checks: actual App, WorkspaceManager, KanbanBoard, SubtaskPanel, TaskComments, ProfileSettings, and their boundary wrappers driven in Edge. Clerk/Convex modules were replaced only in the browser with an in-memory test harness. Queries, mutation payloads, rendered updates, and navigation were observed. These results do not establish backend persistence, authorization, JWT validity, or realtime synchronization.
3. Real signed-out entry: the unmodified local application loaded its landing page and opened the real Clerk sign-in dialog. No test account/session was supplied, so sign-in was not completed and authenticated Convex workflows were not exercised.

Playwright's existing suites ran in Microsoft Edge at 1280×800 and 390×844. Additional actual-screen checks ran at 1280×800, 820×1180, and 390×844. These are viewport checks using desktop Edge, not physical mobile-device or synthesized touch validation. HTML5 drag handlers were driven with a DataTransfer; this does not prove real touch dragging.

## Passed

| Verification | Result | Affected files / evidence |
| --- | --- | --- |
| Build | `npm run build` exited 0; TypeScript and Vite completed. Main JS 577.34 kB, gzip 158.63 kB. Bundle-size warning remains. | package.json; frontend build |
| Unit tests | `npm test`: 7/7 passed in one file. Tests cover member-directory access/data scope, owner protection, and authenticated profile synchronization with mocked identities. | convex/members.test.ts, vitest.config.ts; existing tests only, no backend edits |
| UI tests | `npm run test:ui`: 92/92 passed, 0 failed, about 1.1 minutes. | tests/ui/playwright.config.ts and four specs |
| H1 modal accessibility | 36 fixture checks across personal/workspace/Kanban styles and both configured viewports: initial focus, Tab/Shift+Tab wrapping, hidden/disabled controls, native background isolation, Escape/close/cancel/backdrop dismissal, busy state, successful/failed saves, and restored/fallback focus. Actual application dialogs also received initial field focus during workflow checks. | src/components/ModalDialog.tsx, src/components/ui.css, src/App.tsx, WorkspaceManager.tsx, KanbanBoard.tsx; tests/ui/modal.spec.ts |
| H2 scoped contrast | 2 browser cases with 49 color/state samples each. Minimum corrected normal-text ratio 4.6461675797:1; large personal statistic 13.996663361:1. Rest, hover, focus-within, pressed and selected states were checked where present. Gradients use conservative endpoint bounds. No whole-app WCAG compliance claim. | src/style.css; workspace.css, workspace-overview.css, members.css, kanban.css, collaboration.css; tests/ui/contrast.spec.ts |
| H3 search focus | 16 browser cases: personal/project search, panel/page backgrounds, Tab/Shift+Tab, pointer focus, typing/filtering/clearing, unchanged dimensions, and emulated forced colors. | src/style.css, src/features/workspaces/workspace.css; tests/ui/search-focus.spec.ts |
| H4 boundary component | 38 browser cases: thrown render/query-shaped errors, sanitized Vietnamese fallback, recognized auth/permission guidance, Retry, explicit return/reload, navigation/context reset, persistent failures without automatic retry loops, independent content, and modal cleanup. | src/components/ScreenErrorBoundary.tsx, screen-error.css; tests/ui/error-boundary.spec.ts |
| Personal tasks, actual React UI with mocks | Passed at all three sizes: create with title/description/priority/due date, empty-title submission disabled, edit values and status, status filtering, search/no-results, cancellation of deletion and confirmed deletion. Expected create/update/remove payloads were observed. | src/App.tsx, src/components/Feedback.tsx |
| Workspace/project management, actual React UI with mocks | Passed at all three sizes: switch workspaces, create workspace and select its returned ID, create project, search/no-results/clear filters, change project status, open board and return to project list. Expected mutation payloads were observed. | src/features/workspaces/WorkspaceManager.tsx, WorkspaceOverview.tsx |
| Kanban, actual React UI with mocks | Desktop/mobile passed without intervention. Tablet completed after dismissing obstructing success toasts; see failure F1. Covered create, assign/reassign, edit, native status select, HTML5 drag/drop handler to review, task deletion, subtask add/check/rename/delete, progress updates, comment add/delete. Viewer excluded from assignee options. | src/features/kanban/KanbanBoard.tsx, SubtaskPanel.tsx, TaskComments.tsx |
| Actual boundary placement | Passed at all three sizes: simulated members-query permission failure remained local; projects stayed usable; private marker was absent from DOM; Retry recovered the members panel; personal-query failure reset after navigating away/back; profile view opened. | src/App.tsx, WorkspaceManager.tsx, ScreenErrorBoundary.tsx |
| Real signed-out entry | Landing page and real Clerk sign-in dialog loaded. No failed requests, HTTP responses >=400, or uncaught page errors were observed during this short check. | src/main.tsx, src/App.tsx; browser artifact signed-out-entry.png |
| Static operation wiring | TypeScript AST comparison with HEAD found unchanged query/mutation hook and direct operation callsites in App (11), WorkspaceManager (8), KanbanBoard (13), AutomationDashboard (1). This supports scope preservation; it is not runtime integration proof. | Four integration files above |
| Patch hygiene | `git diff --check` passed. | Current tracked patch |

The additional workflow run initially recorded 11/12 scenario groups passing; the sole failing group was tablet Kanban because of F1. A focused recheck confirmed F1 and completed that same workflow after dismissing notifications.

## Failed

### F1 — Medium: tablet success notifications obscure a subtask Save action

- Affected files: [src/components/ui.css](src/components/ui.css#L26), [src/components/Feedback.tsx](src/components/Feedback.tsx#L17), and the affected action in [src/features/kanban/SubtaskPanel.tsx](src/features/kanban/SubtaskPanel.tsx).
- Reproduction: at 820×1180, open a project; quickly create/edit a task, change its status, add and complete a subtask, then rename the subtask and attempt Save while success notifications remain.
- Evidence: the actual pointer click timed out because a success toast intercepted it. A focused recheck found four active toasts and `document.elementFromPoint` at the Save button center resolved to `.ui-toast.ui-toast-success` (x≈405.59, y≈961.59). Screenshot: [tablet-toast-obstruction.png](node_modules/.cache/regression-verification/tablet-toast-obstruction.png).
- Cause: the fixed bottom-right region can span 420px; each toast accepts pointer events and up to four stack. Above 760px, the mobile top-position rule does not apply.
- Impact: users must dismiss/wait for notifications or use a keyboard workaround before activating a covered action. Dismissing notifications allowed the entire workflow to finish with the expected mutation calls.
- Provenance: the toast placement/hit-testing rules and Feedback implementation predate H1–H4; the current ui.css diff adds modal rules only. This is a verified existing issue, not evidence H1–H4 introduced it.
- Proposed fix, not applied: review tablet placement and maximum stack height, and restrict noninteractive toast hit regions while preserving accessible close controls. Add a regression that uses real pointer clicks with several active notifications before accepting the fix.

### F2 — Low: DESIGN.md still describes pre-H1 modal behavior

- Affected file: [DESIGN.md](DESIGN.md#L380), plus the recommendation near line 414.
- Evidence: it states create/edit forms use custom overlays without focus trapping, Escape, background isolation, or focus restoration. Current callsites use the tested native ModalDialog wrapper.
- Impact: future work may rely on a false description of existing accessibility behavior.
- Proposed fix, not applied: replace those passages with the current H1 implementation and distinguish fixture evidence from authenticated/device checks. Clarify that the introductory browser-testing limitation describes the original inventory, while later H2–H4 sections record subsequent browser checks.

## Not Tested

| Area | Reason / remaining evidence needed | Relevant files |
| --- | --- | --- |
| Completed Clerk sign-in/sign-up, OAuth, sign-out, session expiry/refresh | No authenticated test account or persisted browser session was supplied. Loading a sign-in dialog does not verify authentication. | src/main.tsx, src/App.tsx |
| Real Clerk→Convex JWT integration and authenticated query/mutation recovery | No authenticated session available. Frontend mocks and convex-test identities do not prove deployment integration. | src/main.tsx; frontend query consumers |
| Personal/workspace/project/Kanban persistence after reload | Additional workflow data was in-memory; no live writes were performed. | App.tsx, WorkspaceManager.tsx, KanbanBoard.tsx |
| Realtime cross-client updates and reconnect behavior | Requires authenticated clients connected to the same authorized test workspace/deployment. | Frontend Convex consumers |
| Complete owner/admin/member/viewer permissions matrix | The seven existing unit tests cover only their named cases. Frontend owner-role simulation and assignee filtering do not prove complete server authorization. | TeamMembersPanel.tsx, WorkspaceManager.tsx, KanbanBoard.tsx |
| Real expired-session / revoked-access boundary behavior | Error shapes were simulated; real deployment error transport and cache recovery remain unverified. Retry intentionally retains existing Convex cache semantics. | ScreenErrorBoundary.tsx and wrapped screens |
| Invitations, notifications delivery/read persistence, automation, uploads | No live invite/read/upload/automation actions were performed. These were outside the additional task-workflow checks. | TeamMembersPanel.tsx, NotificationCenter.tsx, AutomationDashboard.tsx, ProfileSettings.tsx |
| Physical touch drag, Safari/Firefox, screen readers, browser zoom/reflow, complete contrast audit | Edge viewports, targeted contrast checks, and forced-colors emulation are narrower evidence. | Frontend / CSS |
| Production deployment/authentication | No deployment was changed or certified. Historical README preview/production notes were not treated as current test results. | README.md; existing deployment files |

## Recommended next actions

1. Address F1 in a separately approved frontend change and rerun tablet pointer checks with stacked success and error notifications.
2. Correct F2 in DESIGN.md so it reflects the implemented H1 behavior.
3. In an authorized non-production environment, use designated test accounts and an isolated workspace to repeat task CRUD, assignment/status changes, subtasks/comments, refresh persistence and two-client synchronization. Exercise owner/admin/member/viewer paths, session expiry, revoked access, and recovery after the cause is resolved.
4. Add persistent end-to-end coverage for those actual authenticated workflows. The current 92 UI tests remain valuable component/CSS checks but do not cover live integration.
5. Track the >500 kB build chunk warning separately; no performance failure or measured user slowdown was established here.
6. Extend manual checks to physical mobile devices, other browser engines and screen readers before broader accessibility or release claims.

## Artifacts

This report is the only project document added by regression verification. Generated build output, browser screenshots and JSON results are in ignored artifact/cache directories; those cached artifacts can be removed by later installs/cleanup.

- [Browser workflow results](node_modules/.cache/regression-verification/browser-results.json)
- [Focused tablet recheck](node_modules/.cache/regression-verification/tablet-recheck.json)
- [Tablet obstruction screenshot](node_modules/.cache/regression-verification/tablet-toast-obstruction.png)
- [Real signed-out entry screenshot](node_modules/.cache/regression-verification/signed-out-entry.png)
- H1–H4 screenshots and computed contrast reports: `node_modules/.cache/modal-test-results/`.

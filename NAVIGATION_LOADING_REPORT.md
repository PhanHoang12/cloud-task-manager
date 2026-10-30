# CloudTask Pro — M4/M5 Navigation & Loading Report

Date: 30 October 2026.

## Result

Implemented M4 first and verified 45 focused browser checks before starting M5. Final validation passes with the completed implementation. No Convex backend functions, schemas, API contracts, permission rules, Clerk configuration, deployment settings or dependencies changed. Existing H1–H4, toast fixes and M1–M3 regressions remain covered.

## Implemented behavior

- Workspace/project selection survives Personal Tasks, Workspace/Kanban and Profile switches. The validated initial workspace is also remembered.
- Personal search/status, workspace search/status/month/chart range and per-project Kanban search remain in memory. Returning from a board preserves the selected workspace and its project-list filters.
- Native History API entries support Back/Forward within the mounted application session. Only random entry/session tokens and positions enter history.state; route IDs and preferences remain in memory.
- Current membership and project results are checked before restoring a board. Loading, deleted/missing selections, permission changes and query errors retain distinct handling.
- Dirty personal/Kanban task dialogs, workspace/project creation, profile edits, subtask add/rename, comments and invitation email receive discard protection. Cancellation retains values and native modal behavior. Pending guarded saves block navigation; successful saves clear their guards. Realtime profile changes do not overwrite local edits.
- The frontend checks the same guard before invoking the unchanged Clerk logout callback. Changing the signed-in identity clears prior account view state.
- M3 destinations still use authorized lookups and target focus. Cancelling draft discard leaves the current screen/popup usable. A mark-read already started may complete. Missing-task warnings belong to their explicit notification request, including under Strict Mode.
- Unloaded metrics/counts use em dashes, ellipses or named loading messages. Genuine empty results display zero after successful loading. Subtask progress remains indeterminate until loaded.
- Loading announcements use status semantics and appropriate busy data regions. Settled personal/Kanban/comment/overview loading text uses the existing text-secondary token and is checked against computed opaque backgrounds at >=4.5:1.
- Inactive screens unmount their queries; filter memory does not retain hidden screen trees. The shared notification trigger/subscription remains mounted across ordinary navigation.

## Final validation

| Command/check | Result |
| --- | --- |
| npm run build | Passed: TypeScript and Vite production build |
| npm test | 44 passed across 3 files |
| npm run test:ui | 350 passed, no remaining failures |
| M4 navigation browser cases | 66 passed: 22 cases across three viewports |
| M5 loading browser cases | 27 passed: 9 cases across three viewports |
| Targeted correction run | 39 passed, including M2 loading, M3 disappearing target, identity reset and loading contrast |
| git diff --check | Passed; Git emitted line-ending conversion warnings |

Browser evidence uses actual React components with browser-only Clerk/Convex service mocks in headless Microsoft Edge. Viewports: desktop 1280×800, tablet 820×1180 and mobile 390×844. Existing test groups keep their configured viewport coverage; the new M4/M5 groups run at all three sizes. Rendered loading captures were reviewed at all three sizes.

The final build retains the existing >500 kB chunk warning: main JS 591.91 kB (163.65 kB gzip). No code splitting or dependency changes were added to this focused patch.

During verification, a Strict Mode effect cleared a missing-task warning; this was corrected by associating the warning with its notification request. The M2 test locator was updated to recognize the intentional loading accessible name. An invitation test was corrected to open its existing disclosure, and loading contrast sampling waits for the incumbent comment entrance animation to settle. Final runs pass.

## Files changed for M4/M5

| File | Change |
| --- | --- |
| [src/components/NavigationExperience.tsx](src/components/NavigationExperience.tsx) | New memory-only navigation, history, preferences and draft guards |
| [src/App.tsx](src/App.tsx) | Shell navigation integration, personal filters/drafts/loading, account guard and identity isolation |
| [src/components/ui.css](src/components/ui.css) | Navigation status and scoped loading-text readability |
| [src/features/workspaces/WorkspaceManager.tsx](src/features/workspaces/WorkspaceManager.tsx) | Validated context restoration, scoped filters, create-form guards and data states |
| [src/features/workspaces/WorkspaceOverview.tsx](src/features/workspaces/WorkspaceOverview.tsx) | Remembered chart range and loading semantics |
| [src/features/workspaces/TeamMembersPanel.tsx](src/features/workspaces/TeamMembersPanel.tsx) | Invitation draft guard |
| [src/features/kanban/KanbanBoard.tsx](src/features/kanban/KanbanBoard.tsx) | Remembered search, task guards, lane loading and request-scoped M3 warning |
| [src/features/kanban/NotificationCenter.tsx](src/features/kanban/NotificationCenter.tsx) | Unknown unread count while loading and cancelled navigation handling |
| [src/features/kanban/SubtaskPanel.tsx](src/features/kanban/SubtaskPanel.tsx) | Draft protection and indeterminate loading progress |
| [src/features/kanban/TaskComments.tsx](src/features/kanban/TaskComments.tsx) | Unsent comment guard and loading announcement |
| [src/features/kanban/AutomationDashboard.tsx](src/features/kanban/AutomationDashboard.tsx) | Status semantics for existing loading copy |
| [src/features/profile/ProfileSettings.tsx](src/features/profile/ProfileSettings.tsx) | Dirty baseline, realtime edit protection and loading status |
| [tests/ui/experience-mock.ts](tests/ui/experience-mock.ts) | New browser-only reactive data, loading, permission and identity seams |
| [tests/ui/navigation.spec.ts](tests/ui/navigation.spec.ts) | New navigation, drafts, history, access, identity and M3 regressions |
| [tests/ui/loading.spec.ts](tests/ui/loading.spec.ts) | New loading-to-zero, readability, error/Retry and subscription regressions |
| [tests/ui/popup.spec.ts](tests/ui/popup.spec.ts) | Allow the loading accessible name while preserving M2 assertions |
| [tests/ui/playwright.config.ts](tests/ui/playwright.config.ts) | Include new suites at all three viewports |
| [DESIGN.md](DESIGN.md) | Document M4/M5 navigation, privacy, drafts and loading behavior |
| [NAVIGATION_LOADING_REPORT.md](NAVIGATION_LOADING_REPORT.md) | This implementation and validation report |

Pre-existing working-tree changes from earlier work were preserved.

## Limitations and manual verification

- Live Clerk sign-in/logout, account switching, Convex authorization, actual realtime delivery and persistence were not tested. Mocks do not prove those integrations.
- Run authenticated owner/admin/member/viewer smoke checks: switch screens and traverse history, revoke membership while away, create/edit/save/fail/cancel forms, receive notifications and follow valid/deleted/inaccessible targets.
- Test screen-reader announcements, browser-native confirmation focus, browser zoom, physical iOS/Android devices and other engines. Emulated sizes are not physical-device validation; no accessibility compliance is claimed.
- Context/preferences are intentionally session-only. Reload, account change, shell unmount or a new tab resets them. No bookmarkable project URLs or cross-session history restoration were added.
- Drafts are not persisted. Confirmed discard removes them. Browsers control beforeunload prompts and may suppress them; crashes, forced termination and unexpected screen failures cannot guarantee draft recovery.
- Existing M3 directory limits remain: 100 workspaces, 100 projects per workspace, 200 tasks per project. Targets outside returned lists receive unavailable guidance.

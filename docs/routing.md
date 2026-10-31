# Persistent application navigation

React Router 7.18.5 (the supported 7.x line, Node >=20) runs in Declarative Mode with BrowserRouter. The latest 8.x line requires Node >=22.22; this workspace currently uses Node 22.20. No runtime upgrade is part of this change.

| URL | View |
| --- | --- |
| `/` | Replaces with `/workspaces` after authentication |
| `/personal` | Personal Tasks |
| `/workspaces` | Workspace directory; adopts the first authorized selection with replacement |
| `/workspaces/:workspaceId` | Selected workspace and project list |
| `/workspaces/:workspaceId/projects/:projectId` | Project Kanban |
| `/workspaces/:workspaceId/projects/:projectId?task=:taskId` | Project and one-time task focus, including refresh/new-tab entry |
| `/profile` | Profile |
| Other or malformed paths | Vietnamese unavailable-route recovery |

## Source of truth and privacy

Page/workspace/project selection comes from the URL. `NavigationExperience` translates existing component navigation callbacks into router destinations; it does not write browser history or maintain a private history stack. React Router owns Back/Forward. A small accepted-location boundary keeps the prior screen mounted while confirming a POP, then accepts the URL or returns using router navigation. It reads the router's `history.state.idx` only to calculate cancellation direction. This is necessary because the supported Declarative BrowserRouter does not expose Data Router's `useBlocker`.

Only identifiers needed for links are in URLs. Names, emails, tokens, form drafts and search/filter values are not serialized. Filters and a last-workspace shortcut stay in memory, scoped to the authenticated account, and reset on reload or account change. A different account may retain a copied/current URL, but it must pass fresh access checks and cannot inherit another account's filters.

## Restoration and access

Clerk and Convex loading/sign-in gates keep protected screens unmounted. Sign-in/up receive the current same-origin path as their forced return destination; no external return URL is taken from a query parameter. Explicit Clerk sign-out retains the existing root return configuration.

WorkspaceManager reuses `workspaces.list` and, only for an authorized workspace, `projects.list`. Kanban mounts only after a matching project belonging to that workspace has been returned. Missing, deleted, mismatched and revoked selections use existing safe recovery. Live role updates continue to govern controls. Unknown identifiers never become authorization claims or bypass backend permissions. Existing directory bounds (100 workspaces/100 projects) remain: targets outside those returned lists recover as unavailable rather than claiming deletion or exposing data.

Notifications retain the existing authorized lookup before changing the URL. Task IDs persist in the query; the router entry key supplies the per-navigation focus request identity. Repeating a notification creates a new request. Back/Forward or refresh to a task link focuses after data loads; ordinary query updates do not repeatedly focus. A missing task leaves the authorized project available with the existing warning.

## Draft protection

Existing explicit dismissals and guarded navigation still ask the Vietnamese discard confirmation. Busy operations block explicit navigation and browser traversal. POP cancellation preserves mounted native dialogs, inline editors, input values and focus. Accepted router entries key the routed view so confirmed navigation discards local forms, including a workspace/project context switch or repeated notification to the same task. Account-scoped filter memory remains outside this boundary. Document reload/exit uses the existing native beforeunload warning; browser/device suppression remains a platform limitation. Drafts are not persisted for crash recovery.

## Hosting and verification

`vercel.json` already rewrites application document URLs to index.html after the Clerk proxy rewrites and excludes API/proxy paths from the catch-all. No hosting configuration change is necessary.

`appRoutes.test.ts` checks route parsing/serialization and malformed selectors. `routing.spec.ts` exercises direct entry/F5 for all screens, copied project links in a new tab, sign-in/loading gates, membership/project validation, account switching/sign-out, notification task focus after reload/traversal, Back/Forward dirty cancellation and pending-save traversal. Existing M3/M4 suites continue to cover filters, repeated notifications, dialogs, popup focus and guards.

Browser fixtures mount the actual App and BrowserRouter, serving the fixture document for direct URL loads and mocking only external services. They do not verify real Clerk OAuth/cookies/JWT acceptance, live Convex synchronization/permissions, Vercel rewrites in production, or physical browser controls/devices. Those require an authorized live-session smoke test. No backend, authentication configuration, secrets or permissions are changed by this work.

## Completed validation

On 31 October 2026, `npm run build` passed, `npm test` passed all 71 tests, and `npm run test:ui` passed all 483 tests across 1280×800, 820×1180 and 390×844 viewports. The additions comprise 14 route unit cases and 23 browser scenarios across three viewports. `git diff --check` passed. The existing Windows teardown issue required stopping the test-owned Vite process after all cases finished; the runner then exited 0 and recorded no failed tests.

The build retains the chunk-size warning: 635.69 kB JavaScript, 178.81 kB gzip. CSS output is unchanged. No bundle optimization or deployment was performed.

An additional reproduced draft-lifecycle defect was fixed: accepting Back from a dirty project-creation form in one workspace previously retained that form in the previous workspace. The accepted-entry key now discards it; cancellation retains it. Permanent regressions cover this case and confirmed inline-draft discard on a repeated notification to the same task.

## Changed files

- Routing: src/main.tsx, src/App.tsx, src/components/NavigationExperience.tsx and new src/lib/appRoutes.ts.
- Notification request identity types: src/lib/notificationNavigation.ts and src/features/kanban/KanbanBoard.tsx.
- Dependency: package.json and package-lock.json (react-router 7.18.5 and its required transitive packages).
- Tests: new src/lib/appRoutes.test.ts and tests/ui/routing.spec.ts; tests/ui/navigation.spec.ts, tests/ui/experience-mock.ts, tests/ui/popup-fixture.tsx, tests/ui/popup-fixture.html, tests/ui/playwright.config.ts and vitest.config.ts.
- Documentation: DESIGN.md and this file.

WorkspaceManager.tsx, notification lookup/mutation behavior, all stylesheets, Convex, API handlers, Clerk issuer/secrets, permissions and vercel.json remain unchanged. The existing authorized workspace/project restoration and hosting fallback are reused.

---
name: CloudTask Pro
description: Source-inspected design system of the existing Vietnamese task-management frontend.
colors:
  focus-ring: "#4665e9"
  text-secondary: "#5e6d83"
  action-primary: "#4665e9"
  action-primary-hover: "#3453d7"
  action-danger: "#b91c1c"
  ws-ink: "#17243e"
  ws-muted: "#5e6d83"
  ws-blue: "#4866ef"
  wo-ink: "#17243e"
  wo-muted: "#5e6d83"
  surface-page: "#f6f8fc"
  surface-default: "#ffffff"
  surface-subtle: "#f8faff"
  surface-hover: "#f1f5ff"
  surface-navigation: "#111d35"
  text-primary: "#17243e"
  text-label: "#33435d"
  text-action-secondary: "#425273"
  text-inverse: "#ffffff"
  border-default: "#dce2ec"
  border-subtle: "#e2e8f0"
  border-hover: "#b6c3ed"
  text-danger-strong: "#991b1b"
  surface-danger: "#fef2f2"
  surface-danger-hover: "#fee2e2"
  border-danger: "#fecaca"
  surface-success: "#f0fdf4"
  border-success: "#bbf7d0"
  text-success: "#166534"
  surface-backdrop: "#10203c99"
  border-danger-hover: "#fca5a5"
  focus-ring-legacy: "#a5b4fc"
rounded:
  action-radius: "9px"
  radius-control: "9px"
  radius-panel: "14px"
  radius-compact: "12px"
  radius-dialog: "16px"
---

# Design System: CloudTask Pro

## Overview

This record began with a source inventory on 29 October 2026. **Verified source** means found in React or CSS, including local overrides; it does not by itself mean observed in a browser. Subsequent H1–H4 and toast-regression sections identify targeted browser-fixture evidence separately. Authenticated workflows, physical devices, font delivery, and assistive-technology behavior remain unverified by those fixtures. No accessibility compliance is claimed.

The implemented interface uses a dark navy navigation area, pale cool page backgrounds, white bordered panels, blue action buttons, rounded corners, and compact Vietnamese labels. Cards organize projects and statistics; lists organize personal work and members. Shadows are generally subtle on content and stronger on floating surfaces. These are descriptive observations, not a newly chosen visual direction.

The user-confirmed commitments in [PRODUCT.md](PRODUCT.md) are Vietnamese-first content, clear hierarchy, consistent design tokens, light modern SaaS styling, responsive desktop/mobile use, and accessibility. The implementation has partial shared tokens and substantial feature-local variation; the commitment to consistency does not establish that all values are already unified.

**Token provenance:** M10 Phase 1 consolidates existing literal values into semantic root properties in src/components/ui.css. The root font in src/style.css and the shell surfaces in src/app-layout.css consume these properties. Existing action and focus names remain compatible aliases. Feature-local workspace and chart properties remain separate; this foundation does not claim every screen has migrated. The M10 section below records adoption, dimensions, exceptions and verification.

**Source map**

| Area | Source |
| --- | --- |
| Global font, personal tasks, unauthenticated entry | [style.css](src/style.css), [App.tsx](src/App.tsx) |
| Render/query failure recovery | [ScreenErrorBoundary.tsx](src/components/ScreenErrorBoundary.tsx), [screen-error.css](src/components/screen-error.css) |
| Shared actions, feedback, confirmations | [ui.css](src/components/ui.css), [Feedback.tsx](src/components/Feedback.tsx) |
| Current navigation and account menu | [app-layout.css](src/app-layout.css), [App.tsx](src/App.tsx) |
| Session navigation, view preferences and draft guards | [NavigationExperience.tsx](src/components/NavigationExperience.tsx) |
| Non-modal popup focus | [useNonModalPopup.ts](src/components/useNonModalPopup.ts) |
| Notification destination resolution | [notificationNavigation.ts](src/lib/notificationNavigation.ts) |
| Workspaces and projects | [workspace.css](src/features/workspaces/workspace.css), [WorkspaceManager.tsx](src/features/workspaces/WorkspaceManager.tsx) |
| Metrics and charts | [workspace-overview.css](src/features/workspaces/workspace-overview.css), [WorkspaceOverview.tsx](src/features/workspaces/WorkspaceOverview.tsx) |
| Members and invitations | [members.css](src/features/workspaces/members.css), [TeamMembersPanel.tsx](src/features/workspaces/TeamMembersPanel.tsx) |
| Project board | [kanban.css](src/features/kanban/kanban.css), [KanbanBoard.tsx](src/features/kanban/KanbanBoard.tsx) |
| Discussion and notifications | [collaboration.css](src/features/kanban/collaboration.css), [TaskComments.tsx](src/features/kanban/TaskComments.tsx), [NotificationCenter.tsx](src/features/kanban/NotificationCenter.tsx) |
| Subtasks | [subtasks.css](src/features/kanban/subtasks.css), [SubtaskPanel.tsx](src/features/kanban/SubtaskPanel.tsx) |
| Automation | [automation-dashboard.css](src/features/kanban/automation-dashboard.css), [AutomationDashboard.tsx](src/features/kanban/AutomationDashboard.tsx), [automation-history.css](src/features/kanban/automation-history.css), [AutomationHistory.tsx](src/features/kanban/AutomationHistory.tsx) |
| Profile | [profile.css](src/features/profile/profile.css), [ProfileSettings.tsx](src/features/profile/ProfileSettings.tsx) |
| Entry and Vietnamese wording | [main.tsx](src/main.tsx), [index.html](index.html), [uiText.ts](src/lib/uiText.ts), [clerkVi.ts](src/lib/clerkVi.ts) |

The current shell is the `ctp-` implementation. Older `app-shell`, `sidebar`, and `cloud-main-nav` styles remain in the global stylesheet but are not the navigation rendered by current JSX. Similarly, legacy workspace statistics and profile-button styles do not describe the current overview metrics or the shared buttons used by the profile. The document prioritizes selectors actually used by components. The initial document-only inventory has since been extended by the implementation records below.

## Colors

### Primary

Shared actions use the frontmatter's `action-primary`, `action-primary-hover`, and `action-danger`. Primary buttons combine white text with the action fill and matching border. The danger value is used for text on a pale red action surface, not as a universal solid destructive fill.

Several blue/indigo values coexist. They are feature-specific existing values, not interchangeable aliases:

| Literal value | Verified use |
| --- | --- |
| `#5455eb` | Cloud icon tile in the current sidebar |
| `#3656a1` / `#a6b8ff` | Selected navigation background / inset left marker and navigation focus outline |
| `#4965ed` | Kanban, subtask progress, discussion and notification accents |
| `#4f46e5` | Profile overline and account-avatar fallback |
| `#a5b4fc` | Retained legacy button/select focus fallback; ui-button and opted-in fields now use focus-ring |
| `#eef2ff` | Repeated pale indigo surface: account hover/fallback, filters, admin badge, profile avatar border |
| `#4866ef` | Existing `--ws-blue`; legacy workspace-primary styling. Current workspace CTAs use the shared primary button classes |

### Secondary

Overview metrics use three contextual properties, `--wo-tone`, `--wo-soft`, and `--wo-border`, set by each variant rather than globally:

| Existing variant | Tone | Soft surface | Border | Current use |
| --- | --- | --- | --- | --- |
| Violet | `#8b5cf6` | `#f5f0ff` | `#e9e0fc` | Workspace count |
| Indigo | `#6366f1` | `#eef0ff` | `#e0e4fc` | Total projects |
| Blue | `#4f7df3` | `#edf4ff` | `#dce8fc` | Active projects |
| Green | `#10b981` | `#ebfbf4` | `#d3f0e3` | Completed projects |

Metric surfaces use `linear-gradient(135deg, #fff 20%, var(--wo-soft))`. Chart statuses are defined directly in React: active blue (`#4f7df3`), completed green (`#10b981`), and archived gray (`#94a3b8`). The same mapping appears in the donut, legend, and monthly stacked bars.

### Neutral

| Literal value or existing token | Verified role |
| --- | --- |
| `#111d35` | Current sidebar background |
| `#e7efff` / `#c6d3ed` | Sidebar foreground / default navigation text |
| `#f6f8fc` | Current shell and workspace page background |
| `#f4f7fc` | Kanban page and comment bubble backgrounds |
| `#f7f9fc` | Global root background outside surface overrides |
| `#ffffff` | Header, panels, cards, fields, and dialogs |
| `#f8faff` | Several select, statistics, discussion-form, and loading surfaces |
| `#1e293b` | Global root text |
| `#132544` | Current shell text |
| `ws-ink` / `wo-ink` | Workspace and overview primary text; values recorded in frontmatter |
| `ws-muted` / `wo-muted` | Scoped supporting text; values recorded in frontmatter |
| `#64748b` | Repeated supporting text in profile, automation, and notifications |
| `#e2e8f0` | Account control borders and several shared dividers |
| `#e3e9f4` / `#e7ebf3` / `#dce3ee` | Header border / workspace panels / Kanban cards |

### Semantic status colors

| Context | Existing treatments |
| --- | --- |
| Shared success toast | Green surface `#f0fdf4`, border `#bbf7d0`, text `#166534` |
| Shared danger action | Surface `#fef2f2`, border `#fecaca`, text from `action-danger`; hover surface `#fee2e2`, border `#fca5a5`, text `#991b1b` |
| Shared error toast | Surface `#fef2f2`, border `#fecaca`, text `#991b1b` |
| Project status badge | Active `#266bba` on `#eaf3ff`; completed `#168454` on `#e7f8ef`; archived `#6b7280` on `#f0f1f3` |
| Personal task priority | Low `#3b9663` on `#e9f7ed`; medium `#bd842e` on `#fff4dd`; high `#d65858` on `#ffe9e8` |
| Kanban priority | Default `#335687` on `#e6effa`; medium `#9a681c` on `#fff2d5`; high and urgent `#a9462c` on `#ffe9e3` |
| Kanban lane marker | To do `#94a3b8`; in progress `#4667ea`; review `#e3a339`; done `#22a17b` |
| Automation KPI number | Blue `#315fe0`; overdue red `#e13c54`; upcoming amber `#e59b18`; completed green `#169963` |
| Automation run badge | Completed `#148453` on `#e5f8ed`; running `#a76c0b` on `#fff4df`; failed `#d33146` on `#ffebee` |

Status colors are accompanied by Vietnamese labels, numbers, or icons. Their shades vary across features; no single success/warning/status token system exists. No dark-theme switch or alternate theme was found in the inspected frontend.

### H2 supporting-text contrast

The shared root token `--text-secondary` is now defined in `src/components/ui.css` (consolidated during M10 Phase 1). It reuses the existing workspace muted-text color. `--ws-muted` and `--wo-muted` are scoped aliases; their frontmatter values are the resolved color. The token is applied only to personal statistic labels/footnotes and descriptions, workspace/project descriptions, overview descriptions/metric supporting text, Kanban descriptions/metadata, member emails, and comment timestamps.

All corrected normal-text roles resolve to `text-secondary`. Personal statistic numbers retain their existing dark foreground and exceed the large-text threshold. Backgrounds, opacity, font sizes, layout, status colors, form behavior, and H1 modal implementation are unchanged.

The following ratios use the WCAG sRGB relative-luminance formula. Ratios are displayed to two decimals; validation compares unrounded values. Overview metric rows use the darkest gradient endpoint as a conservative minimum, not a claim about a sampled text pixel. The other gradient endpoint is white, where the new supporting text is 5.26:1. Workspace descriptions were already compliant; their aliases are consolidated without a visual change. The large personal statistic is included as an unchanged verification.

| Role | Previous foreground | Background / darkest gradient endpoint | Before | After |
| --- | --- | --- | ---: | ---: |
| Statistic label | `#8290a2` | `#ffffff` | 3.25:1 | 5.26:1 |
| Statistic footnote | `#9aa4b2` | `#ffffff` | 2.52:1 | 5.26:1 |
| Personal subtitle | `#8490a2` | `#f6f8fc` | 3.04:1 | 4.95:1 |
| Personal section description | `#8490a2` | `#ffffff` | 3.23:1 | 5.26:1 |
| Personal task description | `#8491a2` | `#ffffff` | 3.20:1 | 5.26:1 |
| Workspace description | `#5e6d83` | `#f6f8fc` | 4.95:1 | 4.95:1 |
| Project section description | `#5e6d83` | `#ffffff` | 5.26:1 | 5.26:1 |
| Project description | `#7a8599` | `#ffffff` | 3.72:1 | 5.26:1 |
| Overview chart description | `#728099` | `#ffffff` | 3.99:1 | 5.26:1 |
| Violet metric supporting text | `#728099` | `#f5f0ff` | 3.57:1 | 4.71:1 |
| Indigo metric supporting text | `#728099` | `#eef0ff` | 3.52:1 | 4.65:1 |
| Blue metric supporting text | `#728099` | `#edf4ff` | 3.61:1 | 4.76:1 |
| Green metric supporting text | `#728099` | `#ebfbf4` | 3.73:1 | 4.92:1 |
| Kanban project description | `#7786a0` | `#f4f7fc` | 3.43:1 | 4.90:1 |
| Kanban task description | `#74829c` | `#ffffff` | 3.88:1 | 5.26:1 |
| Kanban task metadata | `#8492a8` | `#ffffff` | 3.15:1 | 5.26:1 |
| Member email | `#828793` | `#ffffff` | 3.60:1 | 5.26:1 |
| Comment timestamp | `#94a3b8` | `#ffffff` | 2.56:1 | 5.26:1 |
| Large personal statistic | `#202c42` | `#ffffff` | 14.00:1 | 14.00:1 |

Browser regression coverage uses the actual CSS and the actual `WorkspaceOverview` component in isolated fixtures, at 1280×800 and 390×844 viewport sizes. It checks computed colors/backgrounds in rest, hover, focus-within, pressed, and selected states where those states exist. Enabled overview metric gradients are bounded across both opaque endpoints. Disabled controls with reduced opacity retain their existing treatment and are not claimed to meet active-text thresholds.

This is a targeted H2 record, not whole-application accessibility certification. Authenticated application states, other browser engines, physical mobile devices, forced-colors mode, and text outside the listed roles remain outside this validation.

## Typography

**Verified family:** the root declares `Inter, system-ui, Arial, sans-serif`. Google Fonts is imported for Inter weights 400, 500, 600, 700, and 800 with `display=swap`. Form controls inherit the font; the root now reads the shared --font-body property. There is no separate display or monospace family. M10 adds tokens for the existing shared control, caption and body roles; feature heading sizes remain local.

The CSS also requests weights such as 550, 650, 750, and 850. Those declarations are real, but exact font-face selection depends on the delivered fonts and browser. They do not prove that those weights are downloaded. The root sets `font-synthesis: none`.

The root does not set an explicit base font size or global line height. Do not treat a browser default as a project token.

| Context | Declared hierarchy |
| --- | --- |
| Unauthenticated headline | 39px, line height 1.2, letter spacing -2px; 29px at widths up to 700px; weight inherited from heading defaults |
| Workspace page heading | `clamp(26px, 3vw, 35px)`, letter spacing -.035em |
| Personal page heading | 30px, letter spacing -1.2px; 23px up to 700px |
| Profile page heading | 32px |
| Kanban project heading | 32px; 26px up to 600px |
| Section headings | Personal list 17px; workspace projects 20px; overview charts 19px with -.4px spacing; member directory 19px/650, line height 1.4 |
| Metric values | Personal 31px; overview 32px/800, line height 1; donut center 36px/800; automation 30px/850, line height 1.2 |
| Shared action label | 13px/700, line height 1.4 |
| Descriptions and fields | Typically 12–14px; supporting paragraphs often line height 1.5–1.6; profile fields inherit the base size |
| Overlines and metadata | Frequently 9–12px; overlines use 750–800 weight, uppercase copy, and letter spacing varying by feature |

Overview and automation metrics explicitly use `font-variant-numeric: tabular-nums`. There is no consistent mathematical type ratio or global reading-width rule. Font sizes and text shades vary by feature. Long task titles, descriptions, member names/emails, and several summaries use wrapping or `overflow-wrap: anywhere`; account names instead truncate with an ellipsis and disappear at a narrow breakpoint.

## Layout

### Shell and page structure

The current shell is a two-column CSS grid: `var(--ctp-side) minmax(0, 1fr)`. The scoped `--ctp-side` is 264px, reduced to 216px at widths up to 900px. Desktop navigation is sticky at the top, 100vh tall, and padded 24px 16px. The white header has an 82px minimum height and 16px 36px padding.

Page layouts differ deliberately in the current code:

| Surface | Existing structure |
| --- | --- |
| Personal tasks | Shell-specific content padding 30px 36px; four statistic columns; bordered list with toolbar and row actions. The shell override removes the older 1440px maximum width |
| Workspaces | Page padding 38px 5% 70px; workspace switcher; four overview metrics; two chart panels; project cards in three columns at wide widths; invitations and members below |
| Overview charts | Columns `minmax(0, 1fr) minmax(0, 1.15fr)`; monthly bars are 180px tall, with stacks capped at 44px wide |
| Kanban | Page padding 28px 5%; four horizontally scrollable lanes, initially `repeat(4, minmax(240px, 1fr))`; lane gap 14px; cards remain in their lanes |
| Profile | 24px page padding; avatar column `minmax(220px, 300px)` plus `minmax(0, 1fr)` form column; 24px gap |
| Automation | Four KPI columns; two detail columns inside a native disclosure; history table scrolls horizontally with a 950px minimum width |
| Unauthenticated entry | Centered card `width: min(600px, 100%)`, 54px padding, full-height background; logo and paired sign-up/sign-in actions |

Kanban has horizontal overscroll containment, proximity scroll snapping, and lane snap alignment. It is not implemented as a single stacked list on mobile.

### Spacing

M10 introduces shared 8/12/16/24px spacing roles for opted-in primitives. Recurring feature-local gaps remain 8px, 10px, 12px, 14px, 16px, 18px, 20px, 22px and 24px; page spacing is not normalized in this phase.

Representative existing measurements:

- Shared action gap 8px; padding 9px 14px.
- Project card padding 20px; project grid gap 17px.
- Chart card padding 24px; chart grid gap 20px; overview metric padding 20px and grid gap 16px.
- Kanban lane/card padding 14px; card bottom margin 12px.
- Member directory horizontal padding 24px; rows have 22px vertical padding and a 104px minimum height.
- Profile cards use 24px padding; profile form-grid gap is 16px.
- Personal task rows use 20px 26px; list toolbar uses 18px 26px.
- Workspace dialog padding is 27px; personal dialog 28px; Kanban dialog 24px; confirmation 26px.

### Responsive behavior

These are CSS viewport thresholds, not device categories or inferred design tokens. Later rules in the same file can supersede earlier ones.

| Viewport condition | Verified behavior |
| --- | --- |
| Up to 1250px | Overview chart panels stack into one column |
| 761–1200px | Project grid uses two columns; workspace switcher wraps |
| Up to 1100px | Profile outer grid stacks; automation KPI grid becomes two columns |
| Up to 1050px | Personal statistics and current overview metrics become two columns |
| Up to 1000px | Kanban lane minimum becomes 230px until the mobile override applies |
| Up to 950px | Project grid uses two columns, except the later smaller-width single-column rule |
| Up to 920px | Profile form fields become one column |
| Up to 900px | Desktop sidebar width becomes 216px; header and personal-content horizontal padding becomes 22px |
| Up to 760px | Shell becomes block layout. Sidebar is in document flow with a 44px menu toggle; navigation is hidden until expanded and expands vertically. Header minimum height is 68px. Shared buttons gain 44px minimum height; shared icon buttons become 44px square. Personal content and Kanban use 20px 14px padding; personal toolbar stacks. Kanban lane minimum uses `min(290px, calc(100vw - 48px))`. Toasts move to the top safe-area edge |
| Up to 700px | Personal statistics become denser, task actions become vertical, personal form rows become one column, and the entry card/headline shrink |
| Up to 650px | Automation header and detail panels stack; dashboard padding becomes 16px |
| Up to 640px | Comment avatars shrink from 32px to 28px; notification panel uses viewport width minus 24px; Kanban header actions occupy a full row |
| Up to 610px | Project cards become one column; workspace heading/section controls stack. Overview metrics remain two columns with reduced padding; donut and legend stack |
| Up to 600px | Account name is hidden; Kanban form rows become one column |
| Up to 480px | Member rows use a 44px avatar column and put role/actions on the second row; automation history summary becomes one column |
| Up to 400px | Project card/dialog padding shrinks and project card footers wrap |
| Up to 390px | Automation KPI grid becomes one column |

The earlier 680px horizontal mobile-navigation rule is superseded by the later 760px vertical disclosure rules in `app-layout.css`. The initial profile 320px column and 920px outer-grid rule are likewise superseded by the later flexible column definition and 1100px stacking rule.

Wrappers commonly use `min-width: 0`, and selected text uses wrapping to contain long data. Workspace and Kanban dialogs cap height at `calc(100dvh - 32px)` with vertical scrolling; the personal dialog uses `90vh`. These declarations have not been exercised at browser zoom, on real mobile keyboards, or across device safe areas.

## Elevation & Depth

**Verified:** content uses white fills, pale page/column backgrounds, thin borders, and mostly low-opacity shadows. Floating menus, notifications, dialogs, and the entry card use stronger shadows. It is a layered system, with explicit exceptions such as the shadow-free member directory and shared action buttons.

| Existing surface | Exact shadow declaration |
| --- | --- |
| Shared action | `none` |
| Personal statistic card | `0 3px 16px #16234d06` |
| Workspace panel | `0 5px 16px #233b6310` |
| Overview chart card | `0 5px 20px #233b6308` |
| Kanban task card | `0 3px 12px #2440600c` |
| Profile card | `0 10px 30px rgba(15, 23, 42, 0.06)` |
| Automation dashboard/history | `0 8px 30px rgba(24, 43, 80, 0.05)` |
| Member directory | `none`, overriding the generic member panel |
| Member popover | `0 12px 35px #12223c26` |
| Account dropdown | `0 18px 45px rgba(15, 23, 42, 0.16)` |
| Notification panel | `0 18px 50px rgba(15, 23, 42, 0.18)` |
| Shared confirmation | `0 24px 80px #10203c40` |
| Entry card | `0 20px 90px #243b7820` |

Workspace, Kanban, and personal overlays use translucent navy backdrops, with different literal values. Shared confirmations use the native dialog backdrop (`#10203c99`). Account dismissal uses an invisible full-screen button.

Current explicit stacking values include personal overlay 10, account menu 30–32, member popover 40, Kanban overlay 100, workspace overlay 1000, notification panel 99999, and toasts 100000. These are existing local declarations, not a coherent elevation token scale. The native modal confirmation also uses the browser's top layer.

## Shapes

**Verified:** rounded rectangles dominate. Most surfaces have a one-pixel border; circles distinguish avatars, notification controls, and status dots.

| Component | Existing radius / shape |
| --- | --- |
| Shared actions | `action-radius` from frontmatter |
| Shared icon action | 40px square, 44px at the mobile threshold |
| Navigation item / brand tile | 13px |
| Personal statistic / task-list container | 13px / 14px |
| Workspace panel / project card | 17px / 14px |
| Overview metric / chart card | 16px / 18px |
| Kanban lane / task card | 14px / 12px |
| Profile and automation outer cards / member directory | 20px |
| Account dropdown / personal and Kanban dialogs | 16px |
| Workspace dialog / notification panel | 18px |
| Entry card | 24px |
| Member popover / toast / subtask panel | 12px |
| Small priority badges | Personal 5px; Kanban 6px |
| Role, run-status, and realtime badges | Pill radii, usually 999px |
| Comment bubble | Asymmetric `4px 13px 13px 13px` |
| Avatars | Circular; account 36px, member 52px (44px mobile), profile 108px, comments 32px (28px narrow) |

M10 defines control (9px), panel (14px), compact (12px) and dialog (16px) roles. Opted-in Profile and modal fields use the control radius. Unmigrated fields and larger profile cards retain documented local exceptions.

## Components

### Shared buttons and interaction states

Current CTA JSX combines feature classes with `ui-button` and `ui-primary`, `ui-secondary`, or `ui-danger`. The repeated `.ui-button.ui-button` selector establishes the shared base with higher specificity than many older feature rules.

- **Base:** inline flex, centered content, 8px gap, 40px minimum height, 9px 14px padding, 13px/700 type, line height 1.4, one-pixel border, action radius, no shadow, and normal text wrapping.
- **Primary:** white text, shared primary fill/border, shared darker hover fill/border when enabled.
- **Secondary:** white fill, `#dce2ec` border, `#425273` text; hover `#f1f5ff` fill and `#b6c3ed` border.
- **Danger:** pale red fill, red border/text, darker hover treatment as recorded in Colors.
- **Focus:** shared outline is 3px in pale indigo with a 3px offset; navigation, account, and notification controls have their own variations.
- **Disabled:** the shared rule uses .55 opacity and a not-allowed cursor. Member-panel buttons have a more specific disabled rule that uses .5 opacity and the default cursor, including shared buttons inside that panel. Native `disabled` is set in JSX for pending/invalid actions; `aria-disabled` alone would not prevent interaction.
- **Busy:** `aria-busy="true"` inserts a 14px circular indicator with an .8s linear spin. Several controls also switch to Vietnamese pending text. The pseudo-element belongs to shared buttons, not every element carrying `aria-busy`.
- **Motion/states:** shared background/border transitions remain .15s and are disabled under reduced motion. Shared primary, secondary and danger actions now have explicit active states using existing colors. Kanban cards retain their grab/grabbing cursors.

Feature-specific buttons remain for filters, navigation, notification controls, history toggles, and member actions. The shared API does not imply every clickable element has the same dimensions or styling.

### Fields and search

Forms use native inputs, textareas, selects, checkboxes, nested labels or explicit label associations. Required fields and length constraints are defined in JSX. Most fields use white fills and a thin gray border.

- Personal task fields: 8px radius, 11px padding, `outline-color: #5a76f5`.
- Workspace dialog fields: 9px radius and 12px 13px padding.
- Kanban fields: 8px radius and 9px padding; board search has a 10px radius and 13px padding.
- Member invitation fields: 8px radius and 10px padding.
- Profile fields now opt into ui-form: 9px radius, shared border/text/placeholder colors, blue focus border and 3px keyboard outline. Existing 12px 14px padding and field sizes are preserved; the old indigo halo is replaced by the shared outline.
- Comment textarea: 9px radius, 10px 11px padding, blue focus border, and `0 0 0 3px rgba(73, 101, 237, 0.1)` focus shadow.
- Search fields use labeled/aria-labeled inputs. Personal and workspace inner search inputs suppress their own outlines; their wrappers now expose the shared search focus ring through :focus-within (see H3 below).
- Legacy selects retain the global select:focus-visible fallback. ui-button and supported ui-form/ui-field controls use the stronger shared focus token. Unmigrated feature inputs remain outside the automatic opt-in.
- Errors retain existing inline/toast behavior. Opted-in fields now support aria-invalid=true and browser user-invalid borders; semantic error associations and message content remain owned by each feature.

### Search focus (H3)

Personal task search (`.search`) and workspace/project search (`.ws-search`) use a 3px solid wrapper outline with a 2px offset while `:focus-within` matches. The shared root `--focus-ring` aliases `--action-primary`; its resolved color is recorded in frontmatter. M10 extends this token to shared buttons and opted-in fields while retaining existing search focus-within behavior and legacy focus fallbacks.

The outline appears for keyboard focus and pointer focus, remains visible while typing, and disappears when focus leaves the wrapper. Outlines do not participate in layout: border widths, padding, dimensions, and search behavior remain unchanged. Existing panel padding and search margins provide room for the external ring within clipped containers.

The ring is approximately 4.89:1 against white panels and 4.59:1 against the pale page background (`#f6f8fc`). Browser tests check the computed ring against both backgrounds, Tab/Shift+Tab entry/exit, unchanged field/wrapper rectangles, typing/clearing, and emulated forced-colors visibility at desktop and mobile viewport sizes. These are isolated fixture checks using application CSS, not authenticated application or physical-device validation.

### Navigation and account menu

The sidebar contains the cloud brand, three labeled icon-and-text navigation buttons, and an automatic-sync note. Active navigation has a blue fill, white text, and a 3px inset marker. Hover adds a lighter navy surface and a 2px horizontal translation over .16s.

The nav has a Vietnamese accessible name; active buttons use `aria-current="page"`. Mobile disclosure has `aria-expanded` and `aria-controls`. Selecting a page closes the menu and returns focus to its toggle on narrow screens; Escape inside the sidebar also closes it and focuses the toggle. Navigation uses React state and the native History API rather than route links or a routing library; M4 details follow below.

The account control is a pill containing a 36px avatar, truncated name, and chevron. Its dropdown is at most 300px wide, right-aligned, with profile, security, and logout actions. It is a named group of native action buttons opened by a disclosure trigger. Its existing click-away backdrop is excluded from Tab order; keyboard entry, Escape, focus restoration and Tab exit follow the M2 rules below. Native buttons retain their ordinary activation and sequential keyboard behavior.

### Cards, lists, chips, and empty states

- **Personal tasks:** white bordered list, status-cycle icon, title, description, textual status, date, priority badge, and edit/delete actions. Completed titles are struck through. Filter buttons use a pale indigo selected class; they currently lack an `aria-pressed` attribute.
- **Projects:** bordered cards with icon tile, top-right status badge, title, description, and footer. Opening a project is an explicitly labeled icon button; manager status controls are native selects.
- **Members:** avatar and identity on the left, role/actions on the right, separated by horizontal dividers. Count and role labels use pills. Owners have a crown and an unfilled role treatment. Invitations/pending items are inside native `details/summary` disclosures.
- **Member actions:** compact popover with a native role select and destructive action. Opening focuses the select; Escape restores trigger focus; outside pointer events or focus leaving dismiss it. The popover has an accessible group name and a trigger/control relationship.
- **Filters:** overview metrics, donut legend, and monthly bars can filter projects; a filter summary shows result counts, chips, and a clear action.
- **Empty/loading states:** Vietnamese messages, muted icons, and context-specific actions distinguish no data from no matching results. Loading states are mostly text; automation also has a spinner. Not all loading containers have live-region semantics.

### Charts, progress, and Kanban

Overview metric numbers and charts use the contextual tones described in Colors. Donut segments increase stroke width from 23 to 28 on hover/focus, with a focus drop shadow. Unhighlighted segments are dimmed to .25 opacity. SVG segments have button roles, tab stops, accessible labels, pressed state, titles, and Enter/Space handlers. Legend and month controls are native buttons. Month detail uses `aria-live="polite"`; charts include textual counts and percentages.

The Kanban board has four labeled lanes with colored top borders and counts. Draggable cards use grab/grabbing cursors; each task also has a labeled native status select, providing an alternative to dragging. The board's horizontal region is keyboard-focusable and has an explanatory accessible label. Available actions depend on the supplied role, task relationship, and project status; this is interface behavior, not evidence of backend enforcement.

Subtasks use labeled 20px checkboxes, inline editing, count/percentage, and a 7px progress track. Completed text is struck through. Subtask progress and automation completion expose named progressbar roles with numeric limits/current values. Personal summary progress and the secondary automation alert-rate bar do not expose the same progressbar semantics.

Automation keeps secondary progress/notification detail and system history inside a native disclosure. History returns no UI while loading or when its response is unauthorized. When present, it uses native table markup in a focusable horizontal scrolling wrapper, labeled run-status pills, and hover-highlighted rows.

### Assignee names (M1)

Kanban reuses the existing workspace-authorized `members.list` directory for member names and public account emails. Names are shown in the native assignee select and task-card metadata; the current member is marked “(Bạn)”. Emails appear only to distinguish duplicate names or identify a member whose name is unavailable. If labels still collide, the current roster position distinguishes them; that position is not a persistent identifier. Private profile fields are neither requested nor rendered by this presentation code.

Missing names use “Thành viên chưa có tên”; a pending directory uses “Đang tải người phụ trách…”; an assigned ID absent from the returned directory uses “Thành viên không có trong danh sách”. The last label does not assert that the person was removed, since the existing directory is capped at 100 members. Unassigned tasks retain “Chưa phân công”. A known Clerk name can identify the current user while directory information is unavailable.

Original Clerk user IDs remain select values and mutation arguments. The existing exclusion of viewers from new assignments and owner/admin/member/viewer editing rules are preserved. An existing assignment that is loading, absent, or now ineligible remains represented by a disabled selected option until the user explicitly chooses an eligible member or clears it. Directory updates change labels without clearing form state or making a mutation.

The existing Kanban metadata wrapping and native form-control styles are retained; no colors or design tokens change. Pure unit tests cover label resolution, privacy, duplicate names, and missing/loading profiles. Browser fixtures drive the actual Kanban board with mocked services at desktop/tablet/mobile sizes, checking visible labels, original ID payloads, profile and membership updates, long names, existing role restrictions, and H1 focus behavior. Authenticated deployment integration and physical-device/assistive-technology behavior remain separate checks.

### Comment author names

Comment names and monograms now use a board-level directory built from the existing workspace-authorized members.list result. The board reads the existing profiles.me query once to obtain the caller's stored public name fields; no profile lookup accepts an arbitrary author ID. Identical query subscriptions are deduplicated by the installed Convex client, and comments receive the shared name map rather than adding per-task/per-comment profile queries.

Current custom profile display names take precedence, with stored account names as the existing directory fallback. The member query can otherwise substitute JWT identity only for the caller when their stored profile is missing. For that caller, the frontend checks stored fullName/accountName from profiles.me, excluding its clerk.name, so a missing/default profile receives the same neutral fallback another viewer receives.

Pending identity data says “Đang tải tên thành viên…”; unavailable, unnamed, removed or unreturned members say “Thành viên”. The directory is capped at 100 members, so absence does not assert deletion. Names never fall back to IDs/fragments, emails, roster positions, “Tôi” or “(Bạn)”. Monograms derive from the same resolved name for every viewer, with a generic person icon otherwise. Existing mine/other avatar styling may still reflect ownership.

Original author IDs still determine ownership and deletion controls. Stored comments have no author-name snapshot; profile updates change presentation without changing historical content or relationships. Browser evidence uses actual Kanban/comments with service mocks; live multi-account synchronization remains a manual check.

### Discussion and notifications

Discussion expands from a button carrying `aria-expanded`; it shows counts, avatar/author/time metadata, wrapped text bubbles, deletion controls, and a textarea with a 2000-character count. New content enters with an .18s fade/4px slide; the chevron rotates over .2s.

The shared application header contains one 48px circular notification button with a red unread badge, available across authenticated screens. Its accessible name includes the unread count; the decorative badge is hidden from assistive technology. Notifications use an unread background and dot, typed icons, message text, and relative/localized timestamps.

The notification panel is portaled to the document body. JavaScript positions it near the trigger, constrains it to a 12px viewport margin, can place it above the trigger, and recalculates on resize/scroll. It is a non-modal `role="dialog"` with `aria-modal="false"`, named by its “Thông báo” heading; the trigger advertises `aria-haspopup="dialog"` and references the panel. Opening focuses Close, and navigation/dismissal follow the M2 rules below. Positioning, list styling, read actions, unread counts, and existing error feedback are preserved.


### Navigation context and unsaved changes (M4)

NavigationExperience.tsx keeps the selected page, workspace/project IDs and useful view preferences in memory for the mounted authenticated application session. Personal search/status filters, workspace search/status/month filters and chart range, and per-project Kanban search survive screen switches. The initially displayed workspace is remembered after its membership has been validated. Returning from a board retains its workspace and project-list filters. Confirmed navigation discards form drafts; cancelling it retains the current form and its values.

Only the active screen is mounted. Context restoration waits for the current workspace membership list and the selected workspace's project query. It never falls back to another workspace while retaining a stale project ID. Missing/deleted/inaccessible selections receive recovery guidance and a safe project-list action. The existing role from the live workspace result still governs board controls. H4 query errors remain errors, rather than becoming an empty list.

Explicit page, workspace, project and notification navigation uses native history.pushState; the initial entry and validated default workspace use replaceState. Back/Forward restores known entries from this session. History stores only a random session token, entry token and position, while route context remains in memory. No workspace/task/user IDs, searches, drafts or profile values are added to URLs, localStorage or sessionStorage. An identity change keys a new navigation provider so the prior account’s view state is cleared. A reload, authentication-shell unmount or another tab starts fresh; this does not introduce reloadable project URLs or cross-session restoration. Unknown/stale history entries are not interpreted as authorized destinations.

Dirty guards cover personal and Kanban create/edit dialogs, workspace/project creation, profile fields, subtask add/rename, comments and invitation email. Explicit dismissals and navigation ask a native Vietnamese browser confirmation before discarding edits. Unchanged/reverted values do not prompt. Failed saves retain values. Successful saves clear the relevant guard. Profile subscription updates do not overwrite a dirty local profile. Closing a dirty comment panel also confirms before clearing its unsent text. Account logout checks the same frontend guard before invoking the unchanged Clerk callback.

Back/Forward cancellation restores the current history position without remounting the form. Pending guarded operations block navigation, announce that saving is still in progress, and clear that notice after completion. Dirty/pending forms register beforeunload protection for document exit; the browser controls its generic message and may suppress it on some devices. Draft contents are held only by their form components, not in the navigation store. No recovery after a crash or forced termination is promised.

M3 notification destination lookup still uses existing authorized queries. Cancelled discard confirmation leaves the popup/current form open; an already-started mark-read can still complete. Successful navigation selects the target workspace/project, clears a conflicting board search and focuses the target once. A repeated explicit notification resets local board dialog state; ordinary query updates do not repeatedly focus or remount the board.

### Loading and data-state clarity (M5)

Loading is determined by useQuery returning undefined, rather than by array length or numeric truthiness. Personal statistics use an em dash and filter counts use an ellipsis until tasks arrive. Their metric region exposes aria-busy and the task-list loading copy is a status announcement. Successful empty task results show 0 and 0%, with the genuine empty-state action.

Notification loading uses the accessible trigger name “Thông báo, đang tải”, aria-busy, and an ellipsis badge. The panel describes unread counts as loading and announces its loading operation outside the busy list. It does not claim zero, read-all or an empty inbox until the query succeeds. Loading-to-data updates preserve Close focus and the shared trigger instance; Escape/Tab behavior remains M2's non-modal behavior.

Workspace/project loading messages have status semantics. Overview metrics keep their existing em-dash placeholders and announce loading separately from busy metric regions; charts do not expose fabricated zero distributions while pending. Loaded empty project lists show zero metrics and “Chưa có dự án”, while a filter with no matches retains its distinct message. Kanban lane counts use ellipses while task data is pending; subtask progress omits aria-valuenow until loaded. Comment/profile/automation loading copy also has status semantics. Restricted automation history retains its existing no-UI-until-authorized behavior.

Loading instructions use the existing text-secondary token on their light surfaces, including personal tasks, Kanban, comments and the overview status. The implementation uses clear text and existing metric placeholders rather than animated skeletons, artificial delays or extra loading queries. One shared notification subscription remains mounted, inactive screens unmount their queries, and filter memory does not keep duplicate hidden screen trees. No new color/focus tokens, layout system, authentication flow or backend behavior is introduced. Existing H4 boundaries retain explicit Retry and safe access-error guidance.

Browser regressions use actual React screens with Clerk/Convex service mocks in Edge at 1280×800, 820×1180 and 390×844. They cover restoration, scoped filters, dirty cancellation/confirmation, history, access changes, M3 destinations, loading-to-zero, query-error Retry and logical subscription counts. These checks do not establish real screen-reader announcements, live authorization/delivery, physical-device behavior or behavior in other engines.

### Shared notification access and destinations (M3)

A single Notification Center lives in the authenticated application header, before the account disclosure. It is available from Personal Tasks, Workspace/Project views, Kanban and Profile. The board no longer renders its own trigger. The existing circular button, badge, panel styling, realtime `notifications.mine` subscription and `markRead({ notificationId })` operation are retained. Header controls can wrap when a local error fallback needs space.

Activating an unread notification marks it read. When explicit destination identifiers are available, the same button also opens the related content and includes “Mở công việc” or “Mở dự án” in its visible/accessible label. Already-read notifications can still open a destination without another mark-read mutation. Records without a resolvable destination keep their mark-read behavior.

| Modeled kind / record | Supported destination |
| --- | --- |
| `comment` with project/task IDs | Related task card; no exact-comment destination is fabricated because no comment ID is provided |
| `assigned` with project/task IDs | Related task card |
| `deadline_upcoming` with project/task IDs | Related task card |
| `deadline_overdue` with project/task IDs | Related task card |
| A record with project ID only | Project board and heading |
| Missing project ID, including task-ID-only records | No destination; mark-read only |

The four current schema kinds contain project and task IDs. Graceful handling of incomplete records is defensive behavior, not a claim that such records exist in the deployment. Destination resolution does not parse message text, titles, user IDs, or arbitrary URLs.

The existing APIs do not expose a direct project-to-workspace lookup. On explicit activation, the frontend obtains the signed-in user's workspace list, checks each workspace's permission-enforced project list until it finds the specified project, and validates any task ID against that project's permission-enforced task list. It stops on a match/failure and creates no background polling or automatic retries. Existing limits remain: 100 workspaces, 100 projects per workspace and 200 tasks per project. A target outside those returned lists receives unavailable guidance; the interface does not assert a specific deletion or access-loss cause.

The destination view rechecks the live workspace/project lists and passes their existing role to the unchanged board permission controls. Deleted, missing, inaccessible, or mismatched targets show fixed Vietnamese recovery text without exposing raw error details. Recognized authentication failures receive session guidance. A target that becomes unavailable between lookup and rendering receives an explanation and a safe route back; a disappearing task leaves the accessible project usable. No authorization is granted by notification IDs.

Successful in-app navigation selects the correct workspace/project and focuses/scrolls the task card once, or the project heading for project-only records. It opens no edit modal and preserves viewer/inactive-project restrictions. The target uses the existing focus-ring token without a layout shift. Returning to projects retains the resolved workspace. Repeating a notification is an explicit new navigation request; realtime data changes do not repeatedly take focus. A successful explicit request also resets an existing main-screen error boundary, including when the active page remains Workspace. URLs remain under the incumbent state-based navigation.

M2 non-modal semantics, Escape, trigger restoration and portal Tab bridging remain in place. With the trigger in the shared header, forward Tab exit continues to the account trigger. Pending destination resolution announces “Đang mở nội dung liên quan…”. Closing the popup by Escape, its trigger, Close, or outside interaction cancels navigation and ignores late results; an already-started mark-read mutation can still complete. Failures retain the current view and allow retry from the notification list.

Unit tests cover identifier sufficiency, authorized lookup, cancellation and safe feedback. Browser fixtures use the actual application with service mocks at desktop/tablet/mobile viewports for shared access, badge updates, every modeled kind, safe failures, role restrictions, focus, repeated navigation and local H4 recovery. They do not establish live notification delivery, authenticated Clerk/Convex behavior, assistive-technology behavior or physical-device validation. The assignment-notification producer and all other backend behavior are unchanged.

### Non-modal popup keyboard behavior (M2)

`useNonModalPopup` supplies focus entry, exit and dismissal to the account disclosure and Notification Center. Enter/Space retain native button activation. Opening focuses the first enabled action: profile editing in the account popup and Close in notifications. Both triggers expose `aria-expanded` and link to their open popup through `aria-controls`.

Native Tab/Shift+Tab move through the popup's controls. Shift+Tab from the first control closes the popup and returns to its trigger; Tab from the final control closes it and continues to the next visible enabled control after the trigger in the page's tab order. This bridge gives the portaled notification panel a logical exit next to its trigger instead of jumping to the end of the document. Tab from an open trigger can re-enter its popup. Focus moving to another page control dismisses the popup without pulling focus back.

Escape is handled while focus is within the popup or on its trigger, closes the popup, and restores trigger focus. The notification Close action and account backdrop also restore trigger focus. Outside pointer interactions with notifications preserve the clicked page control's normal action and focus. The account backdrop retains its click-away-only behavior and returns focus to its trigger. Account actions restore focus before invoking the existing navigation or Clerk callback, allowing that destination to take focus normally. Stable callbacks avoid resetting focus when account or notification query results update.

These popups do not trap focus, set background inertness, or lock page scrolling. The account backdrop keeps its existing click-away behavior and appearance, while `tabIndex=-1` and `aria-hidden=true` exclude it from keyboard and assistive-technology navigation. All notification mutations and account callbacks retain their existing arguments and behavior.

Edge browser fixtures use the actual App, account implementation and Notification Center with isolated service mocks at 1280×800, 820×1180 and 390×844. They cover keyboard opening, accessible relationships, Escape, trigger restoration, forward/reverse Tab and portal exit, click-away, outside focus, popup switching, loading/empty/error states, query updates, notification actions, account callbacks, and focus transfer into an H1 dialog. Screen-reader announcements, physical devices, other browser engines, and live Clerk/Convex interactions still require manual verification.

### Screen failures (H4)

`ScreenErrorBoundary` is a reusable frontend render-error boundary. Healthy children render directly without an added layout wrapper. Failure UI uses existing white surfaces, neutral borders, `text-secondary`, shared action buttons, and the focus ring. Full-screen fallbacks have responsive margins; compact panel/account fallbacks wrap their actions. Account failures allow the header to wrap while leaving navigation available.

Boundaries isolate the authenticated shell, account menu, main page content, selected project board, workspace overview, invitations, team members, notifications, automation summary/history, subtasks, and discussions. A failure in a secondary panel is kept local when its parent view can still render.

Fallback copy is fixed Vietnamese text. Explicit authentication/permission codes or HTTP statuses take precedence, followed by recognition of the backend's existing Vietnamese access-error messages. Unrecognized or sanitized errors use cautious guidance that includes the possibility of changed access; they do not assert that the service is down. Raw messages, request IDs, stack traces, identifiers, and error payloads are not inserted into the fallback DOM or announcements. No additional error logging or telemetry is introduced.

Retry clears only the failed boundary and remounts its children. It preserves existing query/client-cache semantics and may show the fallback again until the underlying cause is resolved. Navigation/workspace/project identity changes explicitly reset the corresponding boundary. There are no retry timers, automatic redirects, or remount loops. Main-view/board fallbacks offer an explicit return action; account/main/shell fallbacks also offer an explicit page reload. These actions do not grant access or alter authentication.

Fallbacks are named alert regions. They recover lost body focus without taking focus from usable navigation or sibling controls. Existing modal cleanup releases native modality if an owning screen fails while its dialog is open.

Browser tests use isolated fixtures with real React boundaries and ConvexError values, plus transport-shaped query errors; they do not contact Clerk or a Convex deployment. Tests cover sanitization, access guidance, stable failures, explicit recovery, independent content, context resets, reload, and modal cleanup at desktop/mobile viewport sizes. Authenticated smoke tests remain necessary. Event-handler exceptions, unhandled asynchronous rejections, module-startup failures, and errors above these boundaries remain outside their scope; existing mutation handlers and provider wiring are unchanged.

### Feedback and dialogs

Shared success/error toasts pair an icon with a message and close button. Success uses `role="status"` and dismisses after six seconds; errors use `role="alert"` and persist until dismissed. Up to four notices are retained by the provider. Positioning accounts for safe-area insets; the region is bottom-right on desktop and top-right on mobile. Toast regions and passive toast bodies use `pointer-events: none`; only their close buttons re-enable pointer input. Thus message text, icons, padding, and stacked bodies allow clicks through to underlying actions while close buttons remain pointer- and keyboard-operable. Colors, stacking, placement, timers, and announcement roles are preserved. Toast regression fixtures use the real `FeedbackProvider` and `SubtaskPanel` with browser-only data mocks, testing overlapped Save clicks under success/error/mixed stacks, readable messages, dismissal, and timer behavior at 1280×800, 820×1180, and 390×844 in Edge. These fixtures do not verify live Convex persistence or assistive-technology announcements.

Destructive confirmations use a native `dialog` opened with `showModal()`, named/described by heading and paragraph IDs. The cancel button has autofocus. The component includes Tab cycling, cancellation via the native cancel event, and focus restoration to the previous element.

Create/edit forms for personal tasks, workspaces/projects, and Kanban tasks use the shared `ModalDialog` native `dialog` wrapper, opened with `showModal()` and named with `aria-label`. Opening focuses the first enabled input, textarea, or select, with a control/dialog fallback. Tab and Shift+Tab wrap within the dialog and skip hidden or disabled controls. Native modality prevents background interaction and opening locks document scrolling. Escape, close/cancel actions, and backdrop dismissal are available while idle; busy forms keep the dialog open and retain focus. Closing restores document scrolling and focus to the opener, or a remaining control in its scope if the opener disappeared. H1 browser fixtures verify these shared behaviors at desktop/mobile viewport sizes; this does not establish authenticated-form, physical-device, or screen-reader validation.

### Accessibility evidence and limits

Verified source patterns include Vietnamese document language (`lang="vi"`), native controls, labeled actions, selected/expanded/busy state attributes in several components, some status/alert announcements, keyboard chart activation, non-drag task status controls, and the native confirmation dialog.

Reduced-motion handling is partial:

- Shared button spinner animation is removed under reduced motion.
- Donut/bar transitions, member disclosure-chevron transitions, and discussion-entry animation have targeted reduced-motion rules.
- The reduced-motion rule for shared button transitions uses `.ui-button`, which is less specific than the base `.ui-button.ui-button`; it does not override that base transition. The overview metric transition similarly uses the more specific `button.wo-metric` than its reduced-motion override.
- Sidebar hover movement, account/notification effects, discussion-chevron rotation, subtask progress, automation progress, and the automation loading spinner do not have complete reduced-motion coverage in the inspected styles.

Small metadata sizes, muted text, compact controls outside the shared button family, focus visibility, contrast, announcements, table scrolling, modal behavior, and zoom/reflow still need rendered and assistive-technology testing. Source attributes alone do not prove usability or WCAG conformance.

## Do's and Don'ts

### Preserve the verified implementation and confirmed constraints

- **Do** use the existing shared action classes when describing shared primary, secondary, and destructive actions; distinguish them from older feature-only declarations.
- **Do** preserve Vietnamese labels, the current cloud brand, textual statuses, and icon-plus-text cues.
- **Do** retain the non-drag status controls, keyboard chart handlers, disclosure behavior, feedback patterns, and working focus restoration where already implemented.
- **Do** respect feature scope, selector specificity, and later responsive overrides when interpreting values.
- **Don't** present literal measurements as a newly established spacing, radius, or typography token scale.
- **Don't** collapse every blue, green, border, or muted-text value into one invented semantic token.
- **Don't** treat unused legacy selectors as the current shell or claim all controls inherit the shared button styling.
- **Don't** infer accessibility compliance, measured performance, visual validation, or authorization security from this frontend inventory.

### Recommendations — not existing design decisions

These are proposed follow-ups only. They introduce no new values or implemented requirements.

- **Do** verify representative workspace, personal-task, profile, Kanban, notification, and dialog states in desktop/mobile browsers, with long Vietnamese content and browser zoom.
- **Do** assess real text/background contrast and touch targets before declaring any accessibility standard met.
- **Do** consider exposing personal-filter selection programmatically and associating inline field errors with inputs.
- **Do** verify notification/account popup announcements and focus transfers with assistive technologies and live authentication.
- **Do** review reduced-motion cascade specificity and remaining animation coverage.
- **Do** consider consolidating repeated colors and measurements only in a separately authorized implementation change, after checking feature-specific meaning.
- **Don't** silently promote these recommendations into claims about the current application.


## M10 Phase 1: shared design foundation

This section supersedes earlier inventory statements about the absence of shared tokens. It describes an incremental consolidation, not a page redesign or whole-application accessibility certification. The palette, Inter family, navy navigation, blue actions and white surfaces are retained. New property names below reuse incumbent values; no new brand color, typeface, breakpoint or page spacing system is introduced.

### Verified token roles

All roles below are declared at :root in src/components/ui.css. Properties are written without their leading double hyphen in this table.

| Category | Properties and resolved values | Incumbent source / adoption |
| --- | --- | --- |
| Surfaces | surface-page #f6f8fc; surface-default #ffffff; surface-subtle #f8faff; surface-hover #f1f5ff; surface-navigation #111d35; surface-backdrop #10203c99 | Shell, workspace fields, secondary actions; shell background/navigation values are aliases without geometric changes |
| Text | text-primary #17243e; text-secondary #5e6d83; text-label #33435d; text-action-secondary #425273; text-inverse #ffffff | Existing confirmation, H2 supporting text, workspace labels and shared action colors |
| Borders | border-default #dce2ec; border-subtle #e2e8f0; border-hover #b6c3ed | Existing secondary buttons and shared confirmations/error cards |
| Actions | action-primary #4665e9; action-primary-hover #3453d7; action-danger #b91c1c | Existing action tokens; focus-ring remains an alias of action-primary |
| Danger | surface-danger #fef2f2; surface-danger-hover #fee2e2; border-danger #fecaca; border-danger-hover #fca5a5; text-danger-strong #991b1b | Existing destructive buttons and error toasts |
| Success | surface-success #f0fdf4; border-success #bbf7d0; text-success #166534 | Existing success toasts |
| Corners | radius-control 9px; radius-panel 14px; radius-compact 12px; radius-dialog 16px | Existing button, list, toast/error-card and confirmation radii; action-radius aliases radius-control |
| Elevation | shadow-panel none; shadow-toast 0 8px 30px #10203c26; shadow-dialog 0 24px 80px #10203c40 | Existing shared surface treatments; no new halo or feature-wide shadow normalization |
| Typography | font-body Inter, system-ui, Arial, sans-serif; font-size-control 13px; font-size-caption 12px; font-size-body 14px; font-weight-label 700; font-weight-body 400; line-height-control 1.4; line-height-body 1.6 | Existing root family, shared actions, loading text and error-state paragraphs; no global font-size/line-height reset |
| Shared spacing | space-tight 8px; space-content 12px; space-panel 16px; space-section 24px | Existing shared gaps, toast padding, navigation notices and confirmation action separation; page gutters/grids stay local |
| Controls | control-height 40px; control-height-touch 44px; control-padding-block 9px; control-padding-inline 14px; control-disabled-opacity .55 | Existing shared button dimensions and disabled opacity; mobile threshold remains 760px |
| Focus | focus-width 3px; focus-offset 3px; focus-ring #4665e9; focus-ring-legacy #a5b4fc | Existing search ring reused by opted-in buttons and fields; fields retain a 2px outline offset |

### Reusable primitives and adoption

- ui-button retains existing variants and dimensions. Hover and active styles use existing colors. Keyboard focus uses the stronger shared focus-ring instead of the pale legacy ring. aria-disabled controls keep their existing behavior and no longer receive enabled hover/active treatments. Native disabled states, aria-busy spinners, original callbacks and mutation arguments are unchanged. Reduced-motion specificity now matches the base button selector, so its transition override takes effect.
- ui-form is an explicit styling opt-in on the existing ModalDialog wrapper and Profile form. Supported text/email/date/tel/URL/number fields, textareas and selects share border, white surface, 9px corners, text/placeholder colors, focus and disabled/error presentation. Native checkbox, radio, file and hidden controls are excluded from automatic field styling. Field values use the incumbent normal 400 weight and labels use 700. Padding, font sizes, widths, grid gaps and validation behavior remain feature-owned.
- ui-field and ui-label provide the same opt-in presentation for future isolated fields/labels. They add no JavaScript, automatic error messages or validation rules. aria-invalid=true and browser user-invalid presentation use the existing danger color; focus retains a separate blue outline.
- ui-card provides only a border, white surface, dark text, configurable radius and no shadow. ScreenErrorBoundary adopts it with card-radius set to radius-compact (12px); its margins, padding, safe messages and recovery behavior remain unchanged.
- Shared confirmations, toasts and loading text consume tokens without changing placement, dimensions, timing or announcement roles. Passive toast content remains pointer-transparent, with pointer access confined to dismissal buttons.
- Forced-colors mode uses the system Highlight outline for opted-in controls. Existing legacy button/select fallback selectors are retained, rather than replaced by a broad new reset.

### Justified exceptions and boundaries

Personal Tasks retains its metric order, toolbar, list, spacing, typography sizes and page geometry: M9 Phase 3 remains skipped. M9 Phase 1 workspace ordering/disclosure and Phase 2 Kanban ordering/deadline notices/subtask disclosures are preserved.

Feature panels, project/task cards, status/priority colors, charts, account/notification popups and legacy fields remain local unless explicitly opted in. Profile cards retain their larger 20px radius and existing shadow; only Profile form fields/labels adopt the shared form contract. Modal containers retain their established 16/18px radii and padding. Floating notifications retain stronger elevation and their existing geometry. These are bounded migration exceptions, not evidence that every local value is a recommended token.

The stronger selectors repeat only an explicit primitive class, following the existing ui-button approach to resist feature CSS import-order differences. No new global input, label, card or heading selector is introduced. Existing global fallback focus selectors are preserved for compatibility.

### Validation scope

Before/after fixtures use the actual Workspace, Kanban, Personal Tasks and Profile screens with service mocks at 1280x800 and 390x844. Captures and geometry records live under node_modules/.cache/design-foundation. Shared-control regression checks cover computed text/focus contrast, interaction states, fields, busy/disabled presentation, notifications, dialog focus and responsive overflow. This record distinguishes browser-fixture evidence from live Clerk/Convex integration, physical devices, other engines, real screen-reader announcements and guaranteed font delivery, which still require separate verification.


Calculated token pairings use the WCAG sRGB relative-luminance formula; they do not substitute for whole-screen compliance testing:

| Pairing | Contrast |
| --- | ---: |
| White text on action-primary | 4.89:1 |
| White text on action-primary-hover | 6.24:1 |
| text-primary on white | 15.46:1 |
| text-secondary / placeholder on white | 5.26:1 |
| text-secondary on surface-subtle | 5.04:1 |
| Focus ring against white / surface-page | 4.89:1 / 4.59:1 |
| action-danger on surface-danger | 5.91:1 |

The old pale focus fallback is retained as focus-ring-legacy for controls not yet opted in; no improved contrast claim is made for those legacy rings. The confirmation backdrop and danger hover border also gain names without changing their existing rendered values.

/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as attachmentFiles from "../attachmentFiles.js";
import type * as attachmentHttp from "../attachmentHttp.js";
import type * as automation from "../automation.js";
import type * as automationHistory from "../automationHistory.js";
import type * as automationStats from "../automationStats.js";
import type * as automationWatchdog from "../automationWatchdog.js";
import type * as comments from "../comments.js";
import type * as crons from "../crons.js";
import type * as deadlineEmailConfig from "../deadlineEmailConfig.js";
import type * as deadlineEmailDelivery from "../deadlineEmailDelivery.js";
import type * as deadlineEmails from "../deadlineEmails.js";
import type * as deadlineLifecycle from "../deadlineLifecycle.js";
import type * as http from "../http.js";
import type * as illustrationUpload from "../illustrationUpload.js";
import type * as illustrations from "../illustrations.js";
import type * as invitations from "../invitations.js";
import type * as members from "../members.js";
import type * as notifications from "../notifications.js";
import type * as permissions from "../permissions.js";
import type * as polls from "../polls.js";
import type * as profiles from "../profiles.js";
import type * as projectTasks from "../projectTasks.js";
import type * as projects from "../projects.js";
import type * as smtpOutcome from "../smtpOutcome.js";
import type * as subtasks from "../subtasks.js";
import type * as taskAttachments from "../taskAttachments.js";
import type * as tasks from "../tasks.js";
import type * as workspaces from "../workspaces.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  attachmentFiles: typeof attachmentFiles;
  attachmentHttp: typeof attachmentHttp;
  automation: typeof automation;
  automationHistory: typeof automationHistory;
  automationStats: typeof automationStats;
  automationWatchdog: typeof automationWatchdog;
  comments: typeof comments;
  crons: typeof crons;
  deadlineEmailConfig: typeof deadlineEmailConfig;
  deadlineEmailDelivery: typeof deadlineEmailDelivery;
  deadlineEmails: typeof deadlineEmails;
  deadlineLifecycle: typeof deadlineLifecycle;
  http: typeof http;
  illustrationUpload: typeof illustrationUpload;
  illustrations: typeof illustrations;
  invitations: typeof invitations;
  members: typeof members;
  notifications: typeof notifications;
  permissions: typeof permissions;
  polls: typeof polls;
  profiles: typeof profiles;
  projectTasks: typeof projectTasks;
  projects: typeof projects;
  smtpOutcome: typeof smtpOutcome;
  subtasks: typeof subtasks;
  taskAttachments: typeof taskAttachments;
  tasks: typeof tasks;
  workspaces: typeof workspaces;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};

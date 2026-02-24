/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as attendance from "../attendance.js";
import type * as clerkInvitations from "../clerkInvitations.js";
import type * as clusterFollowUps from "../clusterFollowUps.js";
import type * as clusterMembers from "../clusterMembers.js";
import type * as clusters from "../clusters.js";
import type * as followUps from "../followUps.js";
import type * as kids from "../kids.js";
import type * as members from "../members.js";
import type * as myFunctions from "../myFunctions.js";
import type * as protocolMembers from "../protocolMembers.js";
import type * as visitors from "../visitors.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  attendance: typeof attendance;
  clerkInvitations: typeof clerkInvitations;
  clusterFollowUps: typeof clusterFollowUps;
  clusterMembers: typeof clusterMembers;
  clusters: typeof clusters;
  followUps: typeof followUps;
  kids: typeof kids;
  members: typeof members;
  myFunctions: typeof myFunctions;
  protocolMembers: typeof protocolMembers;
  visitors: typeof visitors;
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

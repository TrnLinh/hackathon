/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as aiConfig from "../aiConfig.js";
import type * as collections from "../collections.js";
import type * as identity from "../identity.js";
import type * as lib_auth_config from "../lib/auth_config.js";
import type * as lib_viewer from "../lib/viewer.js";
import type * as memberships from "../memberships.js";
import type * as model_approval from "../model/approval.js";
import type * as model_candidates from "../model/candidates.js";
import type * as model_collections from "../model/collections.js";
import type * as model_common from "../model/common.js";
import type * as model_configuration from "../model/configuration.js";
import type * as model_consent from "../model/consent.js";
import type * as model_jobs from "../model/jobs.js";
import type * as model_lineage from "../model/lineage.js";
import type * as model_media from "../model/media.js";
import type * as model_memories from "../model/memories.js";
import type * as model_operators from "../model/operators.js";
import type * as model_plans from "../model/plans.js";
import type * as model_read from "../model/read.js";
import type * as model_validators from "../model/validators.js";
import type * as system from "../system.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  aiConfig: typeof aiConfig;
  collections: typeof collections;
  identity: typeof identity;
  "lib/auth_config": typeof lib_auth_config;
  "lib/viewer": typeof lib_viewer;
  memberships: typeof memberships;
  "model/approval": typeof model_approval;
  "model/candidates": typeof model_candidates;
  "model/collections": typeof model_collections;
  "model/common": typeof model_common;
  "model/configuration": typeof model_configuration;
  "model/consent": typeof model_consent;
  "model/jobs": typeof model_jobs;
  "model/lineage": typeof model_lineage;
  "model/media": typeof model_media;
  "model/memories": typeof model_memories;
  "model/operators": typeof model_operators;
  "model/plans": typeof model_plans;
  "model/read": typeof model_read;
  "model/validators": typeof model_validators;
  system: typeof system;
  users: typeof users;
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

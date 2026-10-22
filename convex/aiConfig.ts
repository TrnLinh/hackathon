import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { mutation, query } from "./_generated/server";
import {
  aiEnabled,
  deployedProcessorRef,
  latestConfiguration,
} from "./model/configuration";
import { isOperator, optionalViewer, requireViewer } from "./lib/viewer";

// CH-22 public surface. Clients only ever see sanitized capability fields:
// never the processor configuration reference or any credential.

/**
 * Public: missing configuration, or a processor reference this deployment no
 * longer provides, means AI is off. Revision 0 means never configured.
 */
export const current = query({
  args: {},
  returns: v.object({
    enabled: v.boolean(),
    revision: v.number(),
    changedAt: v.union(v.number(), v.null()),
  }),
  handler: async (ctx) => {
    const config = await latestConfiguration(ctx);
    return {
      enabled: aiEnabled(config),
      revision: config?.revision ?? 0,
      changedAt: config?.createdAt ?? null,
    };
  },
});

/** What the signed-in caller may do with the switch. */
export const capabilities = query({
  args: {},
  returns: v.object({
    signedIn: v.boolean(),
    isOperator: v.boolean(),
    processorsConfigured: v.boolean(),
  }),
  handler: async (ctx) => {
    const viewer = await optionalViewer(ctx);
    return {
      signedIn: viewer !== null,
      isOperator: viewer ? await isOperator(ctx, viewer) : false,
      processorsConfigured: deployedProcessorRef() !== undefined,
    };
  },
});

/** Recent availability changes. Who changed it is shown to operators only. */
export const history = query({
  args: {},
  returns: v.array(
    v.object({
      revision: v.number(),
      enabled: v.boolean(),
      changedAt: v.number(),
      changedByYou: v.boolean(),
      changedByName: v.union(v.string(), v.null()),
    }),
  ),
  handler: async (ctx) => {
    const viewer = await optionalViewer(ctx);
    if (!viewer) return [];
    const operator = await isOperator(ctx, viewer);
    const rows = await ctx.db
      .query("aiConfigurations")
      .withIndex("by_revision")
      .order("desc")
      .take(10);
    return Promise.all(
      rows.map(async (row) => ({
        revision: row.revision,
        enabled: row.enabled,
        changedAt: row.createdAt,
        changedByYou: row.actorId === viewer._id,
        changedByName: operator
          ? ((await ctx.db.get(row.actorId))?.name ?? null)
          : null,
      })),
    );
  },
});

/**
 * Operator-only runtime switch (FR-34). Compare-and-set on the revision the
 * operator saw; the client keeps one retry key per intended change.
 */
export const setEnabled = mutation({
  args: {
    enabled: v.boolean(),
    expectedRevision: v.number(),
    retryKey: v.string(),
  },
  returns: v.id("aiConfigurations"),
  handler: async (ctx, args): Promise<Id<"aiConfigurations">> => {
    const viewer = await requireViewer(ctx);
    const ref = args.enabled ? deployedProcessorRef() : undefined;
    return ctx.runMutation(internal.model.configuration.configure, {
      actorId: viewer._id,
      retryKey: args.retryKey,
      expectedRevision: args.expectedRevision,
      enabled: args.enabled,
      ...(ref ? { processorConfigRef: ref } : {}),
    });
  },
});

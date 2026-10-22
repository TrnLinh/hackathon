import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// Workflow metadata and ciphertext only. Public collection operations must wait
// for Tide identity, membership authorization, and verified consent policies.
export default defineSchema({
  collections: defineTable({
    ownerSubject: v.string(),
    encryptedMetadata: v.string(),
    createdAt: v.number(),
  }).index("by_owner", ["ownerSubject"]),
  memberships: defineTable({
    collectionId: v.id("collections"),
    subject: v.string(),
    role: v.union(v.literal("creator"), v.literal("contributor")),
  }).index("by_collection_and_subject", ["collectionId", "subject"]),
  memories: defineTable({
    collectionId: v.id("collections"),
    uploaderSubject: v.string(),
    encryptedPayload: v.string(),
    version: v.number(),
    createdAt: v.number(),
  }).index("by_collection", ["collectionId"]),
});

import { PLAN_COMPONENT_VERSION } from "../design-plan/schema";

/**
 * Identifies the code that turned a plan into bytes: the component set it
 * implements and the pinned PDF libraries. Bump the leading version on any
 * change that can alter output bytes (layout, fonts, metadata, libraries).
 */
export const RENDERER_VERSION = `chorus-pdf/1.0.0 (${PLAN_COMPONENT_VERSION}; pdf-lib 1.17.1; @pdf-lib/fontkit 1.1.1)`;

/** Component versions this renderer draws. */
export const RENDERER_COMPONENT_VERSIONS: readonly string[] = [
  PLAN_COMPONENT_VERSION,
];

/**
 * Fixed CreationDate/ModDate: the renderer release, never the wall clock,
 * so equal input always gives equal bytes. The candidate record keeps the
 * actual freeze time.
 */
export const RENDERER_EPOCH = new Date("2026-10-22T00:00:00Z");

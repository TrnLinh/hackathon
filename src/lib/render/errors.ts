import type { PlanError } from "../design-plan/validate";

export type RenderErrorCode =
  /** The plan failed `validatePlan`; `planErrors` holds the contract codes. */
  | "INVALID_PLAN"
  /** A placed image ref has no entry in `assets`. */
  | "MISSING_ASSET"
  /** Asset bytes are not the declared JPEG/PNG or cannot be decoded. */
  | "INVALID_ASSET"
  /** A credited text has no display name in `options.credits`. */
  | "MISSING_CREDIT"
  /** A character the pinned fonts cannot draw (emoji, CJK, RTL scripts...). */
  | "UNSUPPORTED_CHARACTER"
  /** Text does not fit its frame even at the smallest allowed size. */
  | "TEXT_OVERFLOW"
  /** A vendored font does not match its pinned digest. */
  | "FONT_INTEGRITY";

/** A render failure. No partial PDF is ever returned (CH-10). */
export class RenderError extends Error {
  readonly code: RenderErrorCode;
  readonly planErrors: PlanError[];
  constructor(
    code: RenderErrorCode,
    message: string,
    planErrors: PlanError[] = [],
  ) {
    super(message);
    this.name = "RenderError";
    this.code = code;
    this.planErrors = planErrors;
  }
}

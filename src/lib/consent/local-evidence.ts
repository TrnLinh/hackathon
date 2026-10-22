// INTERIM, NOT TIDE. Until the CH-02 live gate closes, consent decisions are
// recorded with local evidence: the backend stores a statement committing to
// the exact decision (chorus-decision/v1) under this authority. It proves only
// that an authenticated session asked for the decision; it is not a signature
// and never authorizes protected release. Evidence rows stay "unverified".

export const LOCAL_AUTHORITY = "chorus-local-unverified";
export const LOCAL_EVIDENCE_FORMAT = "chorus-local-evidence/v0";
export const LOCAL_REQUEST_PROTOCOL = "chorus-local-request/v0";

/** Purpose disclosed with every manual composition request. */
export const MANUAL_PURPOSE =
  "Private review by the people in this memory and manual photozine composition by the collection creator";

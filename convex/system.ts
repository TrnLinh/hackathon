import { query } from "./_generated/server";

// This public query contains no user data and is safe before auth is wired up.
export const status = query({
  args: {},
  handler: () => ({ application: "Chorus", schemaVersion: 1 }),
});

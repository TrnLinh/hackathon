import { tideAuthConfig } from "./lib/auth_config";

export default tideAuthConfig({
  TIDECLOAK_ISSUER: process.env.TIDECLOAK_ISSUER,
  TIDECLOAK_CLIENT_ID: process.env.TIDECLOAK_CLIENT_ID,
});

import { readFileSync } from "node:fs";
import { config } from "../config.js";

export type ServiceAccountCredentials = {
  client_email: string;
  private_key: string;
  [key: string]: unknown;
};

export function getServiceAccountCredentials(): ServiceAccountCredentials {
  if (config.GOOGLE_SERVICE_ACCOUNT_JSON) {
    const raw = Buffer.from(
      config.GOOGLE_SERVICE_ACCOUNT_JSON,
      "base64",
    ).toString("utf8");
    return JSON.parse(raw) as ServiceAccountCredentials;
  }
  if (config.GOOGLE_APPLICATION_CREDENTIALS) {
    const raw = readFileSync(config.GOOGLE_APPLICATION_CREDENTIALS, "utf8");
    return JSON.parse(raw) as ServiceAccountCredentials;
  }
  throw new Error("No Google credentials configured");
}

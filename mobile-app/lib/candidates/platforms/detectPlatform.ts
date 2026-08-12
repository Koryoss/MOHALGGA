import { SourcePlatform } from "../types";
import { getAdapter } from "./registry";

/**
 * URL -> platform id. Never throws: a malformed URL or an unrecognized
 * host both resolve to "unknown", which is a normal, expected value for
 * callers to branch on (not an exception to catch).
 */
export function detectPlatform(url: string): SourcePlatform | "unknown" {
  try {
    new URL(url); // validates the URL is well-formed
  } catch {
    return "unknown";
  }
  return getAdapter(url)?.platform ?? "unknown";
}

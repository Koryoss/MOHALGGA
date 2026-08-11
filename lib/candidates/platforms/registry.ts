import { PlatformAdapter } from "./types";
import { naverMapAdapter } from "./adapters/naverMapAdapter";
import { catchtableAdapter } from "./adapters/catchtableAdapter";

/**
 * Ordered list of supported platform adapters.
 *
 * To add a new platform (e.g. Instagram, not yet implemented): write an
 * adapter that satisfies PlatformAdapter and add it here. Nothing in
 * detectPlatform, createCandidateFromUrl, session, or UI needs to change.
 */
export const adapters: PlatformAdapter[] = [naverMapAdapter, catchtableAdapter];

export function getAdapter(url: string): PlatformAdapter | undefined {
  return adapters.find((adapter) => {
    try {
      return adapter.matches(url);
    } catch {
      return false;
    }
  });
}

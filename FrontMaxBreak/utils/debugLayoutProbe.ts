// utils/debugLayoutProbe.ts
// TEMPORARY diagnostic-only module — remove once the Match Details gap is
// root-caused. Holds screen-absolute Y measurements captured via
// measureInWindow() from a few components, so a single overlay can display
// real pixel numbers instead of relying on visual screenshot comparison.
export const debugLayout: {
  tabBottom?: number;
  scrollTop?: number;
  adTop?: number;
  adBottom?: number;
} = {};

type Listener = () => void;
const listeners = new Set<Listener>();

export function notifyDebugLayoutChanged() {
  listeners.forEach((l) => l());
}

export function subscribeDebugLayout(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

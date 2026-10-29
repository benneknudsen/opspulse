import { main } from "./sidecar";

// The entrypoint stays thin so `server/sidecar.ts` remains importable from
// tests without starting a listener.
void main();

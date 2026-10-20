import { MvpSchema1792520000000 } from "./1792520000000-mvp-schema.js";
import { SeedCatalog1792520100000 } from "./1792520100000-seed-catalog.js";

// A list and not a glob: the same glob cannot match both the sources (`.ts`) and the build (`.js` next to its `.d.ts`).
export const MIGRATIONS = [MvpSchema1792520000000, SeedCatalog1792520100000];

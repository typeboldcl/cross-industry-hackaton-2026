import { MvpSchema1792520000000 } from "./1792520000000-mvp-schema.js";
import { SeedCatalog1792520100000 } from "./1792520100000-seed-catalog.js";
import { FrontendAlignment1792520200000 } from "./1792520200000-frontend-alignment.js";
import { MvpReview1792520300000 } from "./1792520300000-mvp-review.js";

// A list and not a glob: the same glob cannot match both the sources (`.ts`) and the build (`.js` next to its `.d.ts`).
export const MIGRATIONS = [
  MvpSchema1792520000000,
  SeedCatalog1792520100000,
  FrontendAlignment1792520200000,
  MvpReview1792520300000,
];

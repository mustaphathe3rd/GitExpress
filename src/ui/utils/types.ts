/**
 * Core data models for the GitExpress add-on.
 * These interfaces define the schema for our IndexedDB storage.
 */

export interface Repository {
    id: string; // should be a constant, e.g., 'default-repo' for local-only
    name: string;
    created: number; // Timestamp
    activeBranch: string; // Branch ID
}

export interface Branch {
  id: string;
  name: string;
  head: string | null; // A branch can have no commits yet
  created: number;
}

export interface Commit {
  id: string;
  branchId: string; // Which branch this commit belongs to
  message: string;
  author: string;
  timestamp: number;
  parents: (string | null)[] // change 'parent' to 'parents' and make it an array
  // ---NEW PROPERTIES ---
  isSnapshot: boolean;  // Is this a full snapshot or a delta?
  payload: Uint8Array; // Can be either the compressed snapshot or a compressed delta
  thumbnail?: string; // NEW: Optional property for a Base64 thumbnail image
  
}
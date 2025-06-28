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
  head: string; // ID of the latest commit in this branch
  created: number;
}

export interface Commit {
  id: string;
  branchId: string; // Which branch this commit belongs to
  message: string;
  author: string;
  timestamp: number;
  parent: string | null; // The ID of the parent commit
  documentState: any; // Full document snapshot (for now)
  // We will add a 'delta' property later
}
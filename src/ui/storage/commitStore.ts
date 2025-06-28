import { db } from './db';
import { Commit } from '../utils/types';

/**
 * Creates a new commit in the database with a full snapshot of the document state.
 * @returns {Promise<Commit>} The newly created commit object.
 */
export const createCommit = async (
    message: string,
    parentCommitId: string | null,
    branchId: string,
    documentState: any // The full document state from the sandbox
): Promise<Commit> => {
  // Data Validation
  if (!message || message.trim() === '') {
    throw new Error('Commit message cannot be empty.');
  }
  if (!branchId) {
    throw new Error('Commit must be associated with a branch.');
  }

  try {
    const newCommit: Commit = {
      id: crypto.randomUUID(),
      branchId: branchId,
      message,
      author: 'user', // Placeholder author
      timestamp: Date.now(),
      parent: parentCommitId,
      // For Day 5, we store the full state. We will replace this with a delta on Day 6.
      documentState: documentState,
    };

    await db.commits.add(newCommit);
    console.log(`Commit "${newCommit.id}" created successfully.`);
    return newCommit;
  } catch (error) {
    console.error('Failed to create commit:', error);
    throw new Error('Could not save the commit to the database.');
  }
};

/**
 * Retrieves a specific commit by its ID.
 * @returns {Promise<Commit | undefined>} The commit object.
 */
export const getCommit = async (commitId: string): Promise<Commit | undefined> => {
    if (!commitId) return undefined;
    try {
        return await db.commits.get(commitId);
    } catch(e) {
        console.error("Failed to get commit", e);
        return undefined;
    }
}
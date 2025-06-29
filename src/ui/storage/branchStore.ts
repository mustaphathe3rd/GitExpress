import { db } from './db';
import { Branch } from '../utils/types';

/**
 * Creates a new branch pointing to a specific commit.
 * @returns {Promise<Branch>} The newly created branch.
 */
export const createBranch = async (
    name: string,
    headCommitId: string // The commit the new branch should point to
): Promise<Branch> => {
  // Validation
  if (!name || name.trim() === '') {
    throw new Error('Branch name cannot be empty.');
  }

  try {
    // Integrity Check: ensure branch name is unique
    const existing = await db.branches.where('name').equals(name).first();
    if (existing) {
      throw new Error(`A branch named "${name}" already exists.`);
    }

    const newBranch: Branch = {
      id: crypto.randomUUID(),
      name,
      head: headCommitId,
      created: Date.now(),
    };

    await db.branches.add(newBranch);
    console.log(`Branch "${newBranch.name}" created successfully.`);
    return newBranch;
  } catch (error) {
    console.error(`Failed to create branch "${name}":`, error);
    throw error;
  }
};

// ... (keep getAllBranches and deleteBranch from Day 2)
/**
 * Retrieves all branches from the database.
 * @returns {Promise<Branch[]>} A list of all branches.
 */
export const getAllBranches = async (): Promise<Branch[]> => {
  try {
    return await db.branches.toArray();
  } catch (error) {
    console.error('Failed to retrieve all branches:', error);
    throw new Error('Could not get branches from the database.');
  }
};

/**
 * Deletes a branch from the database.
 * @param {string} branchId The ID of the branch to delete.
 * @returns {Promise<void>}
 */
export const deleteBranch = async (branchId: string, activeBranchId: string): Promise<void> => {
    console.log(`[Storage] Attempting to delete branch ID: ${branchId}`);
    console.log(`[Storage] Current active branch ID: ${activeBranchId}`);

    // Safety Check 1: Do not allow deleting the currently active branch.
    if (branchId === activeBranchId) {
        throw new Error("Cannot delete the branch that is currently active.");
    }

    const branchToDelete = await db.branches.get(branchId);
    if (!branchToDelete) {
        throw new Error("Branch not found in database.");
    }

    // Safety Check 2: Do not allow deleting the 'main' branch.
    if (branchToDelete.name === 'main') {
        throw new Error("The 'main' branch cannot be deleted.");
    }

    // If all checks pass, delete the branch.
    console.log(`[Storage] All safety checks passed. Deleting "${branchToDelete.name}"...`);
    await db.branches.delete(branchId);
    console.log(`[Storage] Database delete operation completed.`);
};

export const getBranchByName = async (name: string): Promise<Branch | undefined> => {
    try {
        return await db.branches.where('name').equals(name).first();
    } catch(e) {
        return undefined;
    }
}
export const updateBranchHead = async (branchId: string, newHeadCommitId: string): Promise<void> => {
    await db.branches.update(branchId, { head: newHeadCommitId });
};
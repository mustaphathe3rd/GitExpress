import { db } from './db';
import { Repository } from '../utils/types';

const REPO_ID = 'gitexpress-repo';

/**
 * Initializes the default repository if it doesn't already exist.
 * This should be called when the add-on is first launched for a document.
 * @returns {Promise<Repository>} The existing or newly created repository.
 */
export async function initializeRepository(): Promise<Repository> {
  try {
    const existingRepo = await db.repositories.get(REPO_ID);
    if (existingRepo) {
      console.log('Repository already exists.');
      return existingRepo;
    }

    console.log('Initializing new repository...');
    const mainBranchId = crypto.randomUUID();
    const newRepo: Repository = {
      id: REPO_ID,
      name: 'Main Repository',
      created: Date.now(),
      activeBranch: mainBranchId,
    };

    // This is a good place for a transaction
    await db.transaction('rw', db.repositories, db.branches, async () => {
      await db.repositories.add(newRepo);
      // Also create the main branch at the same time
      await db.branches.add({
        id: mainBranchId,
        name: 'main',
        head: '', // No commits yet
        created: Date.now(),
      });
    });

    console.log('Repository and main branch initialized successfully.');
    return newRepo;
  } catch (error) {
    console.error('Failed to initialize repository:', error);
    throw new Error('Could not initialize the repository in the database.');
  }
}

/**
 * Retrieves the repository object.
 * @returns {Promise<Repository | undefined>} The repository object.
 */
export const getRepository = async (): Promise<Repository | undefined> => {
  try {
    return await db.repositories.get(REPO_ID);
  } catch (error) {
    console.error('Failed to retrieve repository:', error);
    throw new Error('Could not retrieve repository.');
  }
};

/**
 * Updates the active branch reference in the repository.
 * @param {string} branchId The ID of the new active branch.
 * @returns {Promise<void>}
 */
export const updateActiveBranch = async (branchId: string): Promise<void> => {
  try {
    const updatedCount = await db.repositories.update(REPO_ID, { activeBranch: branchId });
    if (updatedCount === 0) {
        throw new Error("Repository not found, could not update active branch.")
    }
  } catch (error) {
    console.error('Failed to update active branch:', error);
    throw new Error('Could not update the active branch.');
  }
};
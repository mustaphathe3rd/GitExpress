import { db } from './db';
import { Commit } from '../utils/types';
import { calculateAndCompressDelta, reconstructStateFromDelta } from '../utils/deltaEngine';
import { compress, decompress } from 'lz4-wasm';

export const getCommit = async (commitId: string): Promise<Commit | undefined> => {
    if (!commitId) return undefined;
    return await db.commits.get(commitId);
}

/**
 * Reconstructs the full document state for a given commit by walking the delta chain.
 */
export async function reconstructStateToCommit(commitId: string): Promise<any> {
    const commitPath: Commit[] = [];
    let currentCommitId: string | null = commitId;

    while (currentCommitId) {
        const commit = await getCommit(currentCommitId);
        if (!commit) throw new Error(`Commit history is broken. Could not find commit ${currentCommitId}`);
        commitPath.push(commit);
        if (commit.isSnapshot) break;
        currentCommitId = commit.parents[0];
    }

    const baseCommit = commitPath.pop();
    if (!baseCommit || !baseCommit.isSnapshot) {
        throw new Error("Base snapshot not found in commit history.");
    }

    // --- THE FIX IS HERE ---
    // A snapshot's payload is a compressed full state, not a delta. We decompress and parse it.
    const decompressedStateString = new TextDecoder().decode(await decompress(baseCommit.payload));
    let currentState = JSON.parse(decompressedStateString);

    // Now, walk forwards up the chain, applying each delta to the state.
    while (commitPath.length > 0) {
        const nextCommit = commitPath.pop()!;
        currentState = await reconstructStateFromDelta(currentState, nextCommit.payload);
    }

    return currentState;
}

/**
 * Creates a new commit, calculating a delta from its parent.
 */
export const createCommit = async (
    message: string,
    parentCommitIds: (string | null)[],
    branchId: string,
    newDocumentState: any,
    thumbnail: string
): Promise<Commit | null> => { // Note: It can now return null
    if (!message || message.trim() === "") throw new Error('Commit message cannot be empty.');
    const parentCommitId = parentCommitIds[0]; // For delta calculation, we compare against the first parent.

    let payload: Uint8Array;
    let isSnapshot = false;

    if (!parentCommitId) {
        isSnapshot = true;
        const stateString = JSON.stringify(newDocumentState);
        payload = await compress(new TextEncoder().encode(stateString));
    } else {
        isSnapshot = false;
        const parentState = await reconstructStateToCommit(parentCommitId);
        payload = await calculateAndCompressDelta(parentState, newDocumentState);

        // --- THE FIX IS HERE ---
        // If the delta is empty, it means there are no changes. Stop here.
        if (payload.length === 0) {
            console.log("No changes detected between states. Aborting commit.");
            return null; // Return null to indicate no commit was made
        }
    }

    const newCommit: Commit = {
        id: crypto.randomUUID(),
        branchId,
        message,
        author: 'user',
        timestamp: Date.now(),
        parents: parentCommitIds,
        isSnapshot,
        payload,
        thumbnail,
    };

    await db.commits.add(newCommit);
    console.log(`Commit created. Snapshot: ${isSnapshot}, Size: ${payload.byteLength} bytes`);
    return newCommit;
};

/**
 * Retrieves the linear history for a given branch head.
 */
export async function getHistoryForBranch(headCommitId: string | null): Promise<Commit[]> {
    if (!headCommitId) return [];
    const history: Commit[] = [];
    let currentCommitId: string | null = headCommitId;
    while(currentCommitId) {
        const commit = await getCommit(currentCommitId);
        if (!commit) break;
        history.push(commit);

        // --- THE FIX IS HERE ---
        // Be robust: Check for the new 'parents' array first.
        // If it doesn't exist, fall back to the old 'parent' property for backward compatibility.
        if (commit.parents) {
            currentCommitId = commit.parents[0];
        } else {
            // This handles old commit objects that might still be in the database.
            currentCommitId = (commit as any).parent;
        }
    }
    return history;
}

export async function findCommonAncestor(commitIdA: string, commitIdB: string): Promise<string | null> {
    const pathA = new Set<string>();
    let currentA: Commit | undefined = await getCommit(commitIdA);
    while (currentA) {
        pathA.add(currentA.id);
        currentA = currentA.parents[0] ? await getCommit(currentA.parents[0]) : undefined;
    }

    let currentB: Commit | undefined = await getCommit(commitIdB);
    while (currentB) {
        if (pathA.has(currentB.id)) {
            return currentB.id; // This is the first common ancestor found
        }
        currentB = currentB.parents[0] ? await getCommit(currentB.parents[0]) : undefined;
    }

    return null; // No common ancestor
}

export async function getAllCommits(): Promise<Commit[]> {
    try {
        return await db.commits.toArray();
    } catch (e) {
        console.error("Failed to get all commits", e);
        return [];
    }
}
import { compare, applyPatch, Operation } from 'fast-json-patch';
import { compress, decompress } from 'lz4-wasm'; // REMOVED 'init'

/**
 * Calculates the difference between two document states and returns a highly compressed patch.
 * @param baseState The original document state.
 * @param newState The new document state to commit.
 * @returns A Promise that resolves to a Uint8Array representing the compressed delta.
 */
export async function calculateAndCompressDelta(baseState: any, newState: any): Promise<Uint8Array> {
    const patch: Operation[] = compare(baseState, newState);

    if (patch.length === 0) {
        return new Uint8Array();
    }

    const patchString = JSON.stringify(patch);
    const inputBuffer = new TextEncoder().encode(patchString);

    return await compress(inputBuffer);
}

/**
 * Applies a compressed delta to a base state to perfectly reconstruct the new state.
 * @param baseState The original document state.
 * @param compressedDelta The compressed delta as a Uint8Array.
 * @returns A Promise that resolves to the fully reconstructed new document state.
 */
export async function reconstructStateFromDelta(baseState: any, compressedDelta: Uint8Array): Promise<any> {
    const decompressedBuffer = await decompress(compressedDelta);
    const patchString = new TextDecoder().decode(decompressedBuffer);
    const patch: Operation[] = JSON.parse(patchString);
    const { newDocument } = applyPatch(baseState, patch, true, false);
    return newDocument;
}
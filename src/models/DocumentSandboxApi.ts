export interface DocumentSandboxApi {
    // The original function from your boilerplate
    createRectangle: () => void;

    // The new functions for GitExpress
    getFullDocumentState: () => Promise<any>;
    restoreDocumentState: (state: any) => Promise<void>;
    createThumbnail: () => Promise<string>;
}
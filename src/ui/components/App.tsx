import { compare, applyPatch } from 'fast-json-patch';
import "@spectrum-web-components/theme/express/scale-medium.js";
import "@spectrum-web-components/theme/express/theme-light.js";
import { Button } from "@swc-react/button";
import { Textfield } from "@swc-react/textfield";
import { Theme } from "@swc-react/theme";
import React, { useState, useEffect, useCallback, useRef } from "react";
import { DocumentSandboxApi } from "../../models/DocumentSandboxApi";
import { AddOnSDKAPI, Variant, FieldType, InputDialogResult, AlertDialogResult } from "https://new.express.adobe.com/static/add-on-sdk/sdk.js";
import { DiffViewer } from "./DiffViewer/DiffViewer";
import { Branch, Commit } from "../utils/types";
import { createBranch, deleteBranch, getAllBranches, getBranchByName, updateBranchHead } from "../storage/branchStore";
import { createCommit, getCommit, getHistoryForBranch, reconstructStateToCommit, findCommonAncestor } from "../storage/commitStore";
import { getRepository, initializeRepository, updateActiveBranch } from "../storage/repositoryStore";
import mermaid from 'mermaid';
import { generateMermaidSyntax } from '../utils/graphGenerator';
import { HistoryGraph } from './HistoryGraph/HistoryGraph';
import { getAllCommits } from '../storage/commitStore';
import "./App.css";

function formatRelativeTime(timestamp: number): string {
    const now = new Date();
    const seconds = Math.floor((now.getTime() - timestamp) / 1000);
    let interval = seconds / 3600;
    if (interval > 24) return `${Math.floor(interval / 24)}d ago`;
    if (interval > 1) return `${Math.floor(interval)}h ago`;
    interval = seconds / 60;
    if (interval > 1) return `${Math.floor(interval)}m ago`;
    return "just now";
}

export const App = ({ addOnUISdk, sandboxProxy }: { addOnUISdk: AddOnSDKAPI; sandboxProxy: DocumentSandboxApi }) => {
    // STATE MANAGEMENT
    const [isBusy, setIsBusy] = useState(true);
    const [logs, setLogs] = useState<string[]>([]);
    const [branches, setBranches] = useState<Branch[]>([]);
    const [currentBranchName, setCurrentBranchName] = useState<string>("");
    const [history, setHistory] = useState<Commit[]>([]);
    const [commitMessage, setCommitMessage] = useState("");
    const [selectedCommits, setSelectedCommits] = useState<[string | null, string | null]>([null, null]);
    const [diffData, setDiffData] = useState<{ stateA: any, stateB: any } | null>(null);
    const [graphDefinition, setGraphDefinition] = useState("");
    const [historyView, setHistoryView] = useState<'list' | 'graph'>('list');
    const [lastDeletedBranch, setLastDeletedBranch] = useState<{ id: string, name: string, head: string | null } | null>(null);
     const [allCommits, setAllCommits] = useState<Commit[]>([]);

     const log = useCallback((message: string) => {
        setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${message}`, ...prev]);
    }, []);

      const refreshUI = useCallback(async () => {
        setIsBusy(true);
        try {
            const repo = await getRepository() || await initializeRepository();
            const allBranches = await getAllBranches();
            const activeBranch = allBranches.find(b => b.id === repo.activeBranch);
            
            // --- ADD BACK GRAPH DATA GENERATION ---
            const allCommits = await getAllCommits();
            const mermaidSyntax = generateMermaidSyntax(allBranches, allCommits);
            setGraphDefinition(mermaidSyntax);

            setAllCommits(allCommits);
            setBranches(allBranches);
            setCurrentBranchName(activeBranch?.name || "");

            if (activeBranch) {
                const commitHistory = await getHistoryForBranch(activeBranch.head);
                setHistory(commitHistory);
                log(`On branch "${activeBranch.name}".`);
            } else {
                setHistory([]);
            }
        } catch (error) { log(`❌ Error refreshing UI: ${String(error)}`); }
        finally { setIsBusy(false); }
    }, [log]);


    useEffect(() => {
        refreshUI().then(() => log("GitExpress Ready."));
    }, [refreshUI]);
    
    const handleAction = async (action: () => Promise<void>) => {
        if (isBusy) return;
        setIsBusy(true);
        try { await action(); }
        catch (error) { 
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error("Action Error:", error); 
            log(`❌ Action failed: ${String(error)}`); 
            // Show a friendly error dialog to the user
            await addOnUISdk.app.showModalDialog({
                variant: Variant.error,
                title: "An Error Occured",
                description: errorMessage,
            });
        }
        finally { setIsBusy(false); }
    };

    const handleCommit = () => handleAction(async () => {
        if (!commitMessage.trim()) { log("❌ Commit message cannot be empty."); return; }
        const repo = await getRepository();
        if (!repo) throw new Error("Repository not found.");
        const activeBranch = branches.find(b => b.id === repo.activeBranch);
        if (!activeBranch) throw new Error("Could not find active branch.");
        log(`Capturing document state for commit on "${activeBranch.name}"...`);

        let thumbnail = ""; // Default to empty string
        try {
            // Get state and thumbnail at the same time for performance
            const [documentState, thumb] = await Promise.all([
                sandboxProxy.getFullDocumentState(),
                sandboxProxy.createThumbnail()
            ]);
            thumbnail = thumb;

            const newCommit = await createCommit(commitMessage, [activeBranch.head], activeBranch.id, documentState, thumbnail);
            if (newCommit) {
                await updateBranchHead(activeBranch.id, newCommit.id);
                log(`✅ Committed to "${activeBranch.name}".`);
                setCommitMessage("");
                await refreshUI();
            } else { log("⚠️ No changes to commit."); }

        } catch (commitError) {
             // If thumbnail fails, we can still try to commit without it
             console.error("Could not generate thumbnail, attempting commit without it.", commitError);
             log("⚠️ Could not generate thumbnail, committing without preview.");
             const documentState = await sandboxProxy.getFullDocumentState();
             const newCommit = await createCommit(commitMessage, [activeBranch.head], activeBranch.id, documentState, ""); // Pass empty thumbnail
             if (newCommit) {
                await updateBranchHead(activeBranch.id, newCommit.id);
                log(`✅ Committed to "${activeBranch.name}".`);
                setCommitMessage("");
                await refreshUI();
            } else { log("⚠️ No changes to commit."); }
        }
    });

    const handleCreateBranch = () => handleAction(async () => {
        const repo = await getRepository();
        if (!repo) throw new Error("Repository not found.");
        const parentBranch = branches.find(b => b.id === repo.activeBranch);
        if (!parentBranch || !parentBranch.head) { log("❌ Cannot branch. Please make a commit first."); return; }

        const dialogResult = await addOnUISdk.app.showModalDialog({
            title: "Create New Branch",
            variant: Variant.input,
            description: "Enter a name for the new branch.",
            field: { label: "Branch Name", fieldType: FieldType.text, placeholder: `branching from '${parentBranch.name}'`},
            buttonLabels: { primary: "Create" }
        }) as InputDialogResult;

        if (dialogResult && dialogResult.fieldValue) {
            await createBranch(dialogResult.fieldValue, parentBranch.head);
            log(`✅ Branch "${dialogResult.fieldValue}" created.`);
            await handleSwitchBranch(dialogResult.fieldValue, true);
        } else {
            log("Branch creation cancelled.");
        }
    });

    
    const handleDeleteBranch = (branchId: string, branchName: string) => handleAction(async () => {
        // Use the reliable SDK modal dialog for destructive actions
        const dialogResult = await addOnUISdk.app.showModalDialog({
            title: `Delete Branch: "${branchName}"?`,
            description: "This action cannot be undone.",
            variant: Variant.destructive, // Use the correct variant for warnings/deletions
            buttonLabels: { primary: "Delete", secondary: "Cancel" }
        }) as AlertDialogResult;

        // Check the result using the correct 'buttonType' property
        if (dialogResult && dialogResult.buttonType === 'primary') {
            const repo = await getRepository();
            if (!repo) throw new Error("Repository not found.");
            
            log(`Deleting branch "${branchName}"...`);
            await deleteBranch(branchId, repo.activeBranch);
            log(`✅ Branch "${branchName}" deleted.`);
            await refreshUI();
        } else {
            log("Branch deletion cancelled.");
        }
    });
    // --- NEW: handleUndoDelete restores the last deleted branch ---
    const handleUndoDelete = () => handleAction(async () => {
        if (!lastDeletedBranch) return;
        log(`Undoing delete for branch "${lastDeletedBranch.name}"...`);
        // We can re-create the branch using its old head commit
        const restoredBranch = await createBranch(lastDeletedBranch.name, lastDeletedBranch.head);
        // We can even try to restore its original ID for consistency, though this is optional
        // await db.branches.update(restoredBranch.id, { id: lastDeletedBranch.id });
        log("✅ Branch restored.");
        setLastDeletedBranch(null); // Clear the undo state
        await refreshUI();
    });

    const handleSwitchBranch = (newBranchName: string, fromCreate = false) => {
        const action = async () => {
            if (newBranchName === "" || newBranchName === currentBranchName) return;
            log(`Switching to branch "${newBranchName}"...`);
            const targetBranch = await getBranchByName(newBranchName);
            if (!targetBranch) throw new Error(`Branch "${newBranchName}" not found.`);
            if (!targetBranch.head) {
                await sandboxProxy.restoreDocumentState({ children: [] });
            } else {
                const reconstructedState = await reconstructStateToCommit(targetBranch.head);
                await sandboxProxy.restoreDocumentState(reconstructedState);
            }
            await updateActiveBranch(targetBranch.id);
            await refreshUI();
            log(`✅ On branch "${newBranchName}".`);
        };
        if (!fromCreate) { handleAction(action); } else { return action(); }
    };
    
    const handleSelectCommit = (commitId: string, slot: 'A' | 'B') => {
        setSelectedCommits(prev => {
            const [commitA, commitB] = prev;
            if (slot === 'A') { return [commitId, commitB === commitId ? null : commitB]; }
            else { return [commitA === commitId ? null : commitA, commitId]; }
        });
    };

    const handleCompare = () => handleAction(async () => {
        if (!selectedCommits[0] || !selectedCommits[1]) { log("❌ Please select two commits to compare."); return; }
        log("Reconstructing states for comparison...");
        const [stateA, stateB] = await Promise.all([reconstructStateToCommit(selectedCommits[0]), reconstructStateToCommit(selectedCommits[1])]);
        setDiffData({ stateA, stateB });
    });
    
    const handleCloseDiff = () => setDiffData(null);

    const handleMerge = (sourceBranchName: string) => handleAction(async () => {
        const targetBranch = branches.find(b => b.name === currentBranchName);
        const sourceBranch = branches.find(b => b.name === sourceBranchName);
        if (!sourceBranch || !targetBranch || !targetBranch.head || !sourceBranch.head) throw new Error("Branches invalid for merge.");
        log(`Attempting to merge '${sourceBranch.name}' into '${targetBranch.name}'...`);
        const ancestorId = await findCommonAncestor(targetBranch.head, sourceBranch.head);
        if (sourceBranch.head === ancestorId) { log("✅ Already up-to-date."); return; }
        const [ancestorState, targetState, sourceState] = await Promise.all([reconstructStateToCommit(ancestorId!),reconstructStateToCommit(targetBranch.head),reconstructStateToCommit(sourceBranch.head)]);
        if (targetBranch.head === ancestorId) {
            log("Branches can be fast-forwarded...");
            await sandboxProxy.restoreDocumentState(sourceState);
            await updateBranchHead(targetBranch.id, sourceBranch.head);
            log(`✅ Merge successful (fast-forward).`);
        } else {
            log("Branches have diverged. Creating merge commit...");
            const targetPatch = compare(ancestorState, targetState);
            const sourcePatch = compare(ancestorState, sourceState);
            let mergedState;
            try {
                const tempState = applyPatch(ancestorState, sourcePatch, true, false).newDocument;
                mergedState = applyPatch(tempState, targetPatch, true, false).newDocument;
                log("Automatic merge successful. Applying changes...");
            } catch (e) { log(`❌ Merge conflict! Automatic merge failed.`); console.error("Merge conflict details:", e); return; }
            await sandboxProxy.restoreDocumentState(mergedState);
            const thumbnail = await sandboxProxy.createThumbnail();
            const mergeCommit = await createCommit(`Merge branch '${sourceBranch.name}'`,[targetBranch.head, sourceBranch.head],targetBranch.id,mergedState,thumbnail);
            if (mergeCommit) {
                await updateBranchHead(targetBranch.id, mergeCommit.id);
                log(`✅ Merge complete.`);
            }
        }
        await refreshUI();
    });
     const handleRevertCommit = (commitIdToRevert: string, commitMessageToRevert: string) => handleAction(async () => {
        // Using the reliable SDK modal dialog
        const dialogResult = await addOnUISdk.app.showModalDialog({
            title: "Revert this commit?",
            description: `This will create a new commit that undoes the changes from "${commitMessageToRevert}".`,
            variant: Variant.confirmation,
            buttonLabels: { primary: "Revert", secondary: "Cancel" }
        }) as AlertDialogResult;

        if (dialogResult && dialogResult.buttonType === 'primary') {
            const commitToRevert = await getCommit(commitIdToRevert);
            if (!commitToRevert?.parents?.[0]) throw new Error("Cannot revert: Commit or its parent not found.");
            
            const parentId = commitToRevert.parents[0];
            const revertedState = await reconstructStateToCommit(parentId);

            // --- THE FIX IS HERE: Change the order of operations ---

            // 1. FIRST, restore the document to the reverted state.
            await sandboxProxy.restoreDocumentState(revertedState);
            log("Canvas updated to reverted state.");

            // 2. NOW, create the thumbnail from the updated canvas.
            const thumbnail = await sandboxProxy.createThumbnail();

            // 3. Finally, create the commit with the correct state and thumbnail.
            const repo = await getRepository();
            if (!repo) throw new Error("Repository not found.");
            const activeBranch = branches.find(b => b.id === repo.activeBranch);
            if (!activeBranch) throw new Error("Could not find active branch.");

            const newRevertCommit = await createCommit(
                `Revert "${commitMessageToRevert}"`,
                [activeBranch.head],
                activeBranch.id,
                revertedState,
                thumbnail
            );

            if (newRevertCommit) {
                await updateBranchHead(activeBranch.id, newRevertCommit.id);
                log(`✅ Commit "${commitMessageToRevert}" successfully reverted.`);
                await refreshUI();
            }
        } else {
            log("Revert cancelled.");
        }
    });
     return (
        <Theme system="express" scale="medium" color="light" style={{ position: 'relative', height: '100%' }}>
            {isBusy && <div className="loading-overlay"><div className="spinner"></div></div>}
            {diffData && <DiffViewer stateA={diffData.stateA} stateB={diffData.stateB} onClose={handleCloseDiff} />}
            <div className="container">
                <div className="header-container">
                    <img src="assets/logo.png" alt="GitExpress Logo" className="logo" />
                    <div className="header-text"><h1>GitExpress</h1><p>Current Branch: <b>{currentBranchName || "None"}</b></p></div>
                </div>
                  {/* --- FINAL, CORRECT ONBOARDING LOGIC --- */}
                {/* Show the welcome screen ONLY if there are no commits anywhere in the repo. */}
                {allCommits.length === 0 ? (
                    <div className="onboarding-panel">
                        <img src="assets/logo.png" alt="GitExpress Logo" className="onboarding-logo" />
                        <h3>Welcome to GitExpress!</h3>
                        <p>Your ultimate safety net for creative work.</p>
                        <div className="onboarding-steps">
                            <p>To save your first version:</p>
                            <ol>
                                <li>Make a change to your document.</li>
                                <li>Enter a description below (e.g., "Initial design").</li>
                                <li>Click "Commit Changes".</li>
                            </ol>
                        </div>
                        <div className="form-container onboarding-commit">
                            <Textfield placeholder="Commit message" value={commitMessage} onInput={e => setCommitMessage((e.target as any).value)} />
                            <Button variant="accent" onClick={handleCommit} disabled={!commitMessage.trim() || isBusy}>Commit Changes</Button>
                        </div>
                    </div>
            ) : (
                <>
                    {/* All form and action panels */}
                    <div className="form-container">
                        <Textfield placeholder="Commit message" value={commitMessage} onInput={e => setCommitMessage((e.target as any).value)} disabled={isBusy} />
                        <Button variant="primary" onClick={handleCommit} disabled={!commitMessage.trim() || isBusy}>Commit Changes</Button>
                    </div>
                    <div className="merge-panel">
                        <h4>Actions:</h4>
                        <div className="branch-list">
                            <Button onClick={handleCreateBranch} disabled={isBusy || !history.length}>New Branch...</Button>
                            {branches.filter(b => b.name !== currentBranchName).map(branch => (
                                <Button key={branch.id} onClick={() => handleMerge(branch.name)} disabled={isBusy}>Merge '{branch.name}'</Button>
                            ))}
                        </div>
                    </div>
                    <div className="branch-container">
                        <h4>Switch Branch:</h4>
                        {branches.map(branch => (
                            <div key={branch.id} className="branch-row">
                                <Button className="branch-button" onClick={() => handleSwitchBranch(branch.name)} variant={currentBranchName === branch.name ? "accent" : "primary"} disabled={currentBranchName === branch.name || isBusy}>{branch.name}</Button>
                                {branch.name !== 'main' && (<Button className="delete-button" variant="negative" quiet onClick={() => handleDeleteBranch(branch.id, branch.name)} disabled={isBusy || currentBranchName === branch.name}>X</Button>)}
                            </div>
                        ))}
                    </div>
                    <div className="diff-panel">
                        <div className="diff-slot">A: {selectedCommits[0]?.substring(0, 8) || 'None'}</div>
                        <div className="diff-slot">B: {selectedCommits[1]?.substring(0, 8) || 'None'}</div>
                        <Button variant="accent" disabled={!selectedCommits[0] || !selectedCommits[1] || isBusy} onClick={handleCompare}>Compare A & B</Button>
                    </div>

                    {/* --- NEW HISTORY VIEW WITH TOGGLE --- */}
                    <div className="history-container">
                        <div className="history-header">
                            <h4>Commit History for '{currentBranchName || 'None'}'</h4>
                            <Button quiet variant="primary" onClick={() => setHistoryView(historyView === 'list' ? 'graph' : 'list')}>
                                {historyView === 'list' ? 'Show Graph' : 'Show List'}
                            </Button>
                        </div>
                        
                        {history.length === 0 ? (
                            <p className="empty-history">No commits yet on this branch.</p>
                        ) : (
                            historyView === 'list' ? (
                                <div className="history-list">
                                    {history.map(commit => (
                                        <div key={commit.id} className="commit-card">
                                            <div className="commit-thumbnail">{commit.thumbnail ? (<img src={commit.thumbnail} alt="commit preview" />) : (<span>🖼️</span>)}</div>
                                            <div className="commit-details">
                                                <p className="commit-message">{commit.message}</p>
                                                <p className="commit-meta"><strong>{commit.author}</strong> committed {formatRelativeTime(commit.timestamp)}</p>
                                            </div>
                                            <div className="commit-actions">
                                                <Button size="s" quiet variant={selectedCommits[0] === commit.id ? "accent" : "primary"} onClick={() => handleSelectCommit(commit.id, 'A')}>A</Button>
                                                <Button size="s" quiet variant={selectedCommits[1] === commit.id ? "accent" : "primary"} onClick={() => handleSelectCommit(commit.id, 'B')}>B</Button>
                                                <Button size="s" quiet variant="negative" onClick={() => handleRevertCommit(commit.id, commit.message)} disabled={!commit.parents?.[0]}>Revert</Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <HistoryGraph chartData={graphDefinition} />
                            )
                        )}
                    </div>

                    {lastDeletedBranch && (
                        <div className="undo-panel">
                            <p>Branch '{lastDeletedBranch.name}' deleted.</p>
                            <Button quiet onClick={handleUndoDelete}>Undo</Button>
                        </div>
                    )}
                </>
            )}

                <div className="logs">
                    {logs.map((log, i) => <div key={i}>{log}</div>)}
                </div>
            </div>
        </Theme>
    );
};
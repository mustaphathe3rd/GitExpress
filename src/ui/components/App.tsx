import "@spectrum-web-components/theme/express/scale-medium.js";
import "@spectrum-web-components/theme/express/theme-light.js";
import { Button } from "@swc-react/button";
import { Textfield } from "@swc-react/textfield";
import { Theme } from "@swc-react/theme";
import React, { useState, useEffect, useCallback } from "react";
import { DocumentSandboxApi } from "../../models/DocumentSandboxApi";
import { AddOnSDKAPI, Variant, FieldType, InputDialogResult, AlertDialogResult } from "https://new.express.adobe.com/static/add-on-sdk/sdk.js";
import { Branch, Commit } from "../utils/types";
import { createBranch, deleteBranch, getAllBranches, getBranchByName, updateBranchHead } from "../storage/branchStore";
import { createCommit, getHistoryForBranch, reconstructStateToCommit } from "../storage/commitStore";
import { getRepository, initializeRepository, updateActiveBranch } from "../storage/repositoryStore";
import "./App.css";

function formatRelativeTime(timestamp: number): string {
    const now = new Date();
    const seconds = Math.floor((now.getTime() - timestamp) / 1000);
    let interval = seconds / 31536000;
    if (interval > 1) return Math.floor(interval) + " years ago";
    interval = seconds / 2592000;
    if (interval > 1) return Math.floor(interval) + " months ago";
    interval = seconds / 86400;
    if (interval > 1) return Math.floor(interval) + " days ago";
    interval = seconds / 3600;
    if (interval > 1) return Math.floor(interval) + " hours ago";
    interval = seconds / 60;
    if (interval > 1) return Math.floor(interval) + " minutes ago";
    return "just now";
}

export const App = ({ addOnUISdk, sandboxProxy }: { addOnUISdk: AddOnSDKAPI; sandboxProxy: DocumentSandboxApi }) => {
    const [isBusy, setIsBusy] = useState(true);
    const [logs, setLogs] = useState<string[]>([]);
    const [branches, setBranches] = useState<Branch[]>([]);
    const [currentBranchName, setCurrentBranchName] = useState<string>("");
    const [history, setHistory] = useState<Commit[]>([]);
    const [commitMessage, setCommitMessage] = useState("");
    const [newBranchName, setNewBranchName] = useState("");
    const [selectedCommits, setSelectedCommits] = useState<[string | null, string | null]>([null, null]);

    const log = (message: string) => setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${message}`, ...prev]);

    const refreshUI = useCallback(async () => {
        setIsBusy(true);
        try {
            const repo = await getRepository() || await initializeRepository();
            const allBranches = await getAllBranches();
            const activeBranch = allBranches.find(b => b.id === repo.activeBranch);
            setBranches(allBranches);
            setCurrentBranchName(activeBranch?.name || "");
            if (activeBranch) {
                const commitHistory = await getHistoryForBranch(activeBranch.head);
                setHistory(commitHistory);
            } else {
                setHistory([]);
            }
        } catch (error) {
            log(`❌ Error refreshing UI: ${String(error)}`);
        } finally {
            setIsBusy(false);
        }
    }, []);

    useEffect(() => {
        refreshUI().then(() => log("GitExpress Ready."));
    }, [refreshUI]);

    const handleAction = async (action: () => Promise<void>) => {
        if (isBusy) return;
        setIsBusy(true);
        try {
            await action();
        } catch (error) {
            console.error("A detailed error occurred:", error);
            log(`❌ Action failed: ${String(error)}`);
        } finally {
            setIsBusy(false);
        }
    };

    const handleCommit = () => handleAction(async () => {
        if (!commitMessage.trim()) { log("❌ Commit message cannot be empty."); return; }
        const repo = await getRepository();
        if (!repo) throw new Error("Repository not found.");
        const activeBranch = branches.find(b => b.id === repo.activeBranch);
        if (!activeBranch) throw new Error("Could not find active branch.");
        log(`Capturing document state for commit on "${activeBranch.name}"...`);
        // We now capture the state AND the thumbnail at the same time
        const [documentState, thumbnail] = await Promise.all([
            sandboxProxy.getFullDocumentState(),
            sandboxProxy.createThumbnail()
        ]);
        
        const newCommit = await createCommit(
            commitMessage,
            activeBranch.head,
            activeBranch.id,
            documentState,
            thumbnail // Pass the new thumbnail data
        );
        if (newCommit) {
            await updateBranchHead(activeBranch.id, newCommit.id);
            log(`✅ Committed to "${activeBranch.name}".`);
            setCommitMessage("");
            await refreshUI();
        } else {
            log("⚠️ No changes to commit.");
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
        }) as InputDialogResult; // Correctly type the result

        if (dialogResult && dialogResult.fieldValue) {
            const branchName = dialogResult.fieldValue;
            log(`Creating branch "${branchName}"...`);
            const newBranch = await createBranch(branchName, parentBranch.head);
            log(`✅ Branch "${branchName}" created.`);
            await handleSwitchBranch(newBranch.name, true);
        } else {
            log("Branch creation cancelled.");
        }
    });

    const handleDeleteBranch = (branchId: string, branchName: string) => handleAction(async () => {
    const dialogResult = await addOnUISdk.app.showModalDialog({
        title: `Delete Branch: "${branchName}"?`,
        description: "This action cannot be undone.",
        variant: Variant.destructive,
        buttonLabels: { primary: "Delete", secondary: "Cancel" }
    }) as AlertDialogResult;

    // THE FIX: The correct property is 'buttonType', not 'buttonId'.
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
        if (!fromCreate) {
            handleAction(action);
        } else {
            return action();
        }
    };

    const handleSelectCommit = (commitId: string, slot: 'A' | 'B') => {
        setSelectedCommits(prev => {
            const [commitA, commitB] = prev;
            if (slot === 'A') {
                return [commitId, commitB === commitId ? null : commitB];
            } else { // slot === 'B'
                return [commitA === commitId ? null : commitA, commitId];
            }
        });
    };
    
    return (
        <Theme system="express" scale="medium" color="light" style={{ position: 'relative', height: '100%' }}>
            {isBusy && <div className="loading-overlay"><div className="spinner"></div></div>}
            <div className="container">
                <div className="header-container">
                    <img src="assets/logo.png" alt="GitExpress Logo" className="logo" />
                    <div className="header-text">
                        <h1>GitExpress</h1>
                        <p>Current Branch: <b>{currentBranchName || "None"}</b></p>
                    </div>
                </div>
                
                <div className="form-container">
                    <Textfield placeholder="Commit message" value={commitMessage} onInput={e => setCommitMessage((e.target as any).value)} disabled={isBusy} />
                    <Button variant="primary" onClick={handleCommit} disabled={!commitMessage.trim() || isBusy}>Commit Changes</Button>
                </div>

                <div className="branch-container">
                     <h4>Actions:</h4>
                    <Button onClick={handleCreateBranch} disabled={isBusy || !currentBranchName || !history.length}>New Branch...</Button>
                </div>

                <div className="branch-container">
                    <h4>Switch Branch:</h4>
                    {branches.map(branch => (
                        <div key={branch.id} className="branch-row">
                            <Button
                                className="branch-button"
                                onClick={() => handleSwitchBranch(branch.name)}
                                variant={currentBranchName === branch.name ? "accent" : "primary"}
                                disabled={currentBranchName === branch.name || isBusy}
                            >
                                {branch.name}
                            </Button>
                            {branch.name !== 'main' && (
                                <Button
                                    className="delete-button"
                                    variant="negative"
                                    quiet
                                    onClick={() => handleDeleteBranch(branch.id, branch.name)}
                                    disabled={isBusy || currentBranchName === branch.name}
                                >
                                    X
                                </Button>
                            )}
                        </div>
                    ))}
                </div>

                {/* --- NEW DIFF SELECTION PANEL --- */}
                <div className="diff-panel">
                    <div className="diff-slot">A: {selectedCommits[0]?.substring(0, 8) || 'None'}</div>
                    <div className="diff-slot">B: {selectedCommits[1]?.substring(0, 8) || 'None'}</div>
                    <Button
                        variant="accent"
                        disabled={!selectedCommits[0] || !selectedCommits[1] || isBusy}
                    >
                        Compare A & B
                    </Button>
                </div>

                {/* --- UPGRADED HISTORY VIEW --- */}
                <div className="history-container">
                    <h4>Commit History for '{currentBranchName || 'None'}'</h4>
                    <div className="history-list">
                        {history.length > 0 ? (
                            history.map(commit => (
                                <div key={commit.id} className="commit-card">
                                    <div className="commit-thumbnail">
                                        {/* --- THE UI UPGRADE --- */}
                                    {/* If a thumbnail exists, show it. Otherwise, show the placeholder. */}
                                    {commit.thumbnail ? (
                                        <img src={commit.thumbnail} alt="commit preview" />
                                    ) : (
                                        <span>🖼️</span>
                                    )}
                                        </div>
                                    <div className="commit-details">
                                        <p className="commit-message">{commit.message}</p>
                                        <p className="commit-meta">
                                            <strong>{commit.author}</strong> committed {formatRelativeTime(commit.timestamp)}
                                        </p>
                                    </div>
                                    <div className="commit-actions">
                                        <Button
                                            size="s" quiet
                                            variant={selectedCommits[0] === commit.id ? "accent" : "primary"}
                                            onClick={() => handleSelectCommit(commit.id, 'A')}
                                            disabled={isBusy}
                                        >A</Button>
                                        <Button
                                            size="s" quiet
                                            variant={selectedCommits[1] === commit.id ? "accent" : "primary"}
                                            onClick={() => handleSelectCommit(commit.id, 'B')}
                                            disabled={isBusy}
                                        >B</Button>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <p className="empty-history">No commits yet.</p>
                        )}
                    </div>
                </div>

                <div className="logs">
                    {logs.map((log, i) => <div key={i}>{log}</div>)}
                </div>
            </div>
        </Theme>
    );
};
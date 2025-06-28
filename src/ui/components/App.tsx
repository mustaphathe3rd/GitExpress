import "@spectrum-web-components/theme/express/scale-medium.js";
import "@spectrum-web-components/theme/express/theme-light.js";
import { Button } from "@swc-react/button";
import { Picker } from "@swc-react/picker"; // Correct: Comes from its own package
import { MenuItem } from "@swc-react/menu"; // Correct: Comes from its own package
import { Textfield } from "@swc-react/textfield"; // Correct: Now installed
import { Theme } from "@swc-react/theme";
import React, { useState, useEffect, useCallback } from "react";
import { DocumentSandboxApi } from "../../models/DocumentSandboxApi";
import { AddOnSDKAPI } from "https://new.express.adobe.com/static/add-on-sdk/sdk.js";
import { Branch } from "../utils/types";
import { createBranch, getAllBranches, getBranchByName, updateBranchHead } from "../storage/branchStore";
import { createCommit, getCommit } from "../storage/commitStore";
import { getRepository, initializeRepository, updateActiveBranch } from "../storage/repositoryStore";
import "./App.css";

const App = ({ addOnUISdk, sandboxProxy }: { addOnUISdk: AddOnSDKAPI; sandboxProxy: DocumentSandboxApi }) => {
    const [logs, setLogs] = useState<string[]>([]);
    const [branches, setBranches] = useState<Branch[]>([]);
    const [currentBranch, setCurrentBranch] = useState<Branch | null>(null);
    const [newBranchName, setNewBranchName] = useState("");
    const [commitMessage, setCommitMessage] = useState("");

    const log = (message: string) => setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${message}`, ...prev]);

    const refreshBranches = useCallback(async () => {
        // This function may not exist if you haven't implemented it yet.
        const repo = await getRepository();
        if (!repo) {
            await initializeRepository();
        }
        const allBranches = await getAllBranches();
        const activeRepo = await getRepository(); // Fetch again after possible init
        const activeBranch = allBranches.find(b => b.id === activeRepo?.activeBranch);
        
        setBranches(allBranches);
        setCurrentBranch(activeBranch || allBranches.find(b => b.name === "main") || null);
        if (activeBranch) {
            log(`On branch "${activeBranch.name}".`);
        }
    }, []);

    useEffect(() => {
        refreshBranches();
    }, [refreshBranches]);

    const handleCommit = async () => {
        if (!currentBranch) {
            log("❌ Error: No active branch.");
            return;
        }
        try {
            log("Capturing document state for commit...");
            const documentState = await sandboxProxy.getFullDocumentState();
            const newCommit = await createCommit(
                commitMessage || `Commit to ${currentBranch.name}`,
                currentBranch.head, // parent commit
                currentBranch.id,
                documentState
            );
            await updateBranchHead(currentBranch.id, newCommit.id);
            log(`✅ Committed to "${currentBranch.name}".`);
            setCommitMessage("");
            await refreshBranches();
        } catch (error: any) {
            log(`❌ Commit failed: ${error.message}`);
        }
    };

    const handleCreateBranch = async () => {
        if (!currentBranch) {
            log("❌ Error: Cannot create a branch from nothing. Please commit first.");
            return;
        }
        try {
            log(`Creating branch "${newBranchName}"...`);
            await createBranch(newBranchName, currentBranch.head);
            log(`✅ Branch "${newBranchName}" created.`);
            setNewBranchName("");
            await refreshBranches();
        } catch (error: any) {
            log(`❌ Failed to create branch: ${error.message}`);
        }
    };

    const handleSwitchBranch = async (newBranchName: string) => {
        if (newBranchName === currentBranch?.name) return;
        try {
            log(`Switching to branch "${newBranchName}"...`);
            const targetBranch = await getBranchByName(newBranchName);
            if (!targetBranch) throw new Error("Branch not found.");
            
            const headCommit = await getCommit(targetBranch.head);
            if (!headCommit?.documentState) {
                await sandboxProxy.restoreDocumentState({ children: [] });
                log(`Switched to "${newBranchName}" with empty state.`);
            } else {
                await sandboxProxy.restoreDocumentState(headCommit.documentState);
                log(`Switched to "${newBranchName}" and restored its state.`);
            }

            // THE FIX IS HERE: The function only needs one argument.
            await updateActiveBranch(targetBranch.id);
            
            await refreshBranches();
        } catch (error: any) {
            log(`❌ Failed to switch branch: ${error.message}`);
        }
    };

    return (
        <Theme system="express" scale="medium" color="light">
            <div className="container">
                <div className="header">
                    <h1>GitExpress - Day 5 Test</h1>
                    <p>Current Branch: <b>{currentBranch?.name || "None"}</b></p>
                </div>
                <div className="form-container">
                    <Textfield placeholder="Commit message" value={commitMessage} onInput={e => setCommitMessage((e.target as any).value)} />
                    <Button variant="primary" onClick={handleCommit} disabled={!commitMessage.trim()}>Commit Changes</Button>
                </div>
                <div className="form-container">
                    <Textfield placeholder="New branch name" value={newBranchName} onInput={e => setNewBranchName((e.target as any).value)} />
                    <Button onClick={handleCreateBranch} disabled={!newBranchName.trim()}>Create Branch</Button>
                </div>
                <div className="form-container">
                    <Picker
                        style={{ width: '100%' }}
                        value={currentBranch?.name}
                        onInput={(e: any) => handleSwitchBranch(e.target.value)}
                        placeholder="Switch branch..."
                    >
                        {branches.map(branch => (
                            <MenuItem key={branch.id} value={branch.name}>{branch.name}</MenuItem>
                        ))}
                    </Picker>
                </div>
                <div className="logs">
                    {logs.map((log, i) => <div key={i}>{log}</div>)}
                </div>
            </div>
        </Theme>
    );
};

export default App;
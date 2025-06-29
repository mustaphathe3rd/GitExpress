import React from 'react';
import { Button } from "@swc-react/button";
import { Branch } from '../../utils/types';

type BranchPanelProps = {
    branches: Branch[];
    currentBranchName: string;
    onCreateBranch: () => void;
    onSwitchBranch: (name: string) => void;
    onDeleteBranch: (branchId: string, branchName: string) => void;
    isBusy: boolean;
};

export const BranchPanel = (props: BranchPanelProps) => {
    const {
        branches,
        currentBranchName,
        onCreateBranch,
        onSwitchBranch,
        onDeleteBranch,
        isBusy
    } = props;

    return (
        <>
            <div className="form-container">
                <Button onClick={onCreateBranch} disabled={isBusy} style={{ width: '100%' }}>
                    Create New Branch...
                </Button>
            </div>

            <div className="branch-container">
                <h4>Switch Branch:</h4>
                {branches.map(branch => (
                    <div key={branch.id} className="branch-row">
                        <Button
                            className="branch-button"
                            onClick={() => onSwitchBranch(branch.name)} // This now correctly calls the handler
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
                                onClick={() => onDeleteBranch(branch.id, branch.name)} // This now correctly calls the handler
                                disabled={isBusy || currentBranchName === branch.name}
                            >
                                X
                            </Button>
                        )}
                    </div>
                ))}
            </div>
        </>
    );
};
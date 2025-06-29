import React from 'react';
import { Button } from "@swc-react/button";
import { Textfield } from "@swc-react/textfield";

type CommitPanelProps = {
    commitMessage: string;
    onCommitMessageChange: (value: string) => void;
    onCommit: () => void;
    isBusy: boolean;
};

export const CommitPanel = ({ commitMessage, onCommitMessageChange, onCommit, isBusy }: CommitPanelProps) => {
    return (
        <div className="form-container">
            <Textfield
                label="Commit Message"
                value={commitMessage}
                onChange={(e) => onCommitMessageChange((e.target as any).value)}
                disabled={isBusy}
            />
            <Button
                variant="primary"
                onClick={onCommit}
                disabled={!commitMessage.trim() || isBusy}
            >
                Commit Changes
            </Button>
        </div>
    );
};
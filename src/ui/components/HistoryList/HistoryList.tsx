import React from 'react';
import { Commit } from '../../utils/types';

type HistoryListProps = {
    history: Commit[];
    branchName: string;
};

export const HistoryList = ({ history, branchName }: HistoryListProps) => {
    return (
        <div className="history-container">
            <h4>Commit History for '{branchName || 'None'}'</h4>
            <ul>
                {history.length > 0 ? (
                    history.map(commit => (
                        <li key={commit.id}>
                            {commit.message} - <small>{new Date(commit.timestamp).toLocaleTimeString()}</small>
                        </li>
                    ))
                ) : (
                    <li>No commits yet.</li>
                )}
            </ul>
        </div>
    );
};
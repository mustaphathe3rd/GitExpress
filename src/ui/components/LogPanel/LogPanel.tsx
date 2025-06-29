import React from 'react';

type LogPanelProps = {
    logs: string[];
};

export const LogPanel = ({ logs }: LogPanelProps) => {
    return (
        <div className="logs">
            {logs.map((log, i) => <div key={i}>{log}</div>)}
        </div>
    );
};
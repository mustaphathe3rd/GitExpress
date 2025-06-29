import React from 'react';

type LoadingIndicatorProps = {
    isBusy: boolean;
};

export const LoadingIndicator = ({ isBusy }: LoadingIndicatorProps) => {
    if (!isBusy) return null;

    return (
        <div className="loading-overlay">
            <div className="spinner"></div> 
        </div>
    );
};
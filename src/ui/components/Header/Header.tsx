import React from 'react';
// Step 2.1: Import the logo image
type HeaderProps = {
    currentBranchName: string;
};

export const Header = ({ currentBranchName }: HeaderProps) => {
    return (
        // Step 2.2: We'll wrap the contents in a container for better alignment
        <div className="header-container">
            {/* Step 2.3: Add the img tag for your logo */}
            <img src="assets/logo.png" alt="GitExpress Logo" className="logo" />
            <div className="header-text">
                <h1>GitExpress</h1>
                <p>Current Branch: <b>{currentBranchName || "None"}</b></p>
            </div>
        </div>
    );
};
import React from 'react';
import { Button } from "@swc-react/button";

type DiffViewerProps = {
    stateA: any;
    stateB: any;
    onClose: () => void;
};

// A helper function to render a simplified view of a document state
const renderState = (state: any, label: string) => {
    if (!state || !state.children) {
        return <div className="diff-canvas-placeholder">No data for Version {label}</div>;
    }

    // We create an SVG canvas to draw on
    return (
        <div className="diff-canvas">
            {state.children.map((node: any) => {
                // Default styles
                let styles: React.CSSProperties = {
                    position: 'absolute',
                    transform: `translate(${node.translation?.x || 0}px, ${node.translation?.y || 0}px)`,
                    border: '1px solid #000',
                    backgroundColor: '#ccc'
                };

                // Apply styles based on node type
                if (node.type === "Ellipse") {
                    styles.width = (node.radiusX || 25) * 2;
                    styles.height = (node.radiusY || 25) * 2;
                    styles.borderRadius = '50%';
                } else { // For Rectangles, Groups, Text
                    styles.width = node.width || 50;
                    styles.height = node.height || 50;
                }

                if (node.fill?.type === "Color") {
                    const { red, green, blue, alpha } = node.fill.color;
                    styles.backgroundColor = `rgba(${red * 255}, ${green * 255}, ${blue * 255}, ${alpha})`;
                }

                return <div key={node.id} style={styles}></div>;
            })}
        </div>
    );
};


export const DiffViewer = ({ stateA, stateB, onClose }: DiffViewerProps) => {
    return (
        <div className="diff-modal-overlay">
            <div className="diff-modal-content">
                <div className="diff-header">
                    <h2>Comparing Versions</h2>
                    <Button variant="primary" onClick={onClose}>Close</Button>
                </div>
                <div className="diff-images-container">
                    <div className="diff-image-wrapper">
                        <h3>Version A</h3>
                        {renderState(stateA, 'A')}
                    </div>
                    <div className="diff-image-wrapper">
                        <h3>Version B</h3>
                        {renderState(stateB, 'B')}
                    </div>
                </div>
            </div>
        </div>
    );
};
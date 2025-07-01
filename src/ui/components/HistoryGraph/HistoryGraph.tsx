import React, { useEffect, useRef } from 'react';
import mermaid from 'mermaid';

mermaid.initialize({
    startOnLoad: false,
    theme: 'base',
    themeVariables: {
        primaryColor: '#f0f0f0',
        primaryTextColor: '#333',
        lineColor: '#6e6e6e',
        fontSize: '12px'
    }
});

type HistoryGraphProps = { chartData: string };

export const HistoryGraph = ({ chartData }: HistoryGraphProps) => {
    const mermaidRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (mermaidRef.current && chartData) {
            try {
                mermaid.render('git-graph-svg', chartData).then(({ svg }) => {
                    if (mermaidRef.current) {
                        mermaidRef.current.innerHTML = svg;
                    }
                });
            } catch (error) {
                console.error("Mermaid rendering error:", error);
                if (mermaidRef.current) mermaidRef.current.innerHTML = `<p style="color: red;">Error rendering graph.</p>`;
            }
        }
    }, [chartData]);

    return <div key={chartData} ref={mermaidRef} className="mermaid-graph-container"></div>;
};
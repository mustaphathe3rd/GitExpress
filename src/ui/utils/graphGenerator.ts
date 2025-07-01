import { Commit, Branch } from './types';

export function generateMermaidSyntax(branches: Branch[], commits: Commit[]): string {
    if (commits.length === 0) return "graph TD\n    A[No commits yet]";
    
    const sortedCommits = [...commits].sort((a, b) => a.timestamp - b.timestamp);
    let mermaidStr = "graph BT;\n";
    const commitMap = new Map(commits.map(c => [c.id, c]));

    branches.forEach((branch, index) => {
        mermaidStr += `    classDef branch${index} fill:#${Math.floor(Math.random()*16777215).toString(16).padStart(6, '0')},stroke:#333,stroke-width:2px,color:#fff;\n`;
    });

    sortedCommits.forEach(commit => {
        const message = commit.message.replace(/"/g, '#quot;').substring(0, 20);
        mermaidStr += `    ${commit.id}("${message}");\n`;
        commit.parents.forEach(parentId => {
            if (parentId && commitMap.has(parentId)) {
                mermaidStr += `    ${commit.id} --> ${parentId};\n`;
            }
        });
    });

    const branchLabelNodes: string[] = [];
    branches.forEach((branch, index) => {
        if (branch.head && commitMap.has(branch.head)) {
            mermaidStr += `    class ${branch.head} branch${index};\n`;
            const labelNodeId = `branch_label_id_${index}`;
            mermaidStr += `    ${labelNodeId}["${branch.name}"]:::branch${index};\n`;
            mermaidStr += `    ${labelNodeId} --o ${branch.head};\n`;
            branchLabelNodes.push(labelNodeId);
        }
    });

    return mermaidStr;
}
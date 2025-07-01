import addOnSandboxSdk from "add-on-sdk-document-sandbox";
import { editor } from "express-document-sdk";
import { DocumentSandboxApi } from "../models/DocumentSandboxApi";

const { runtime } = addOnSandboxSdk.instance;

// FINAL, VICTORIOUS serializeChildren function
function serializeChildren(children: any): any[] {
    const serializedObjects: any[] = [];
    for (const child of children) {
        try {
            const serializedChild: any = {
                id: child.id,
                type: child.type,
                translation: child.translation,
                fill: child.fill,
                stroke: child.stroke,
                width: child.width,
                height: child.height,
                radiusX: child.radiusX,
                radiusY: child.radiusY,
                // THE FIX: The log proves the property is 'text'
                text: child.text
            };

            // Handle recursive serialization for groups
            if (child.type === "Group" && child.children && child.children.length > 0) {
                serializedChild.children = serializeChildren(child.children);
            }
            serializedObjects.push(serializedChild);
        } catch (e) {
            console.error(`Serialization error for node ${child.id}:`, e);
        }
    }
    return serializedObjects;
}

// FINAL, VICTORIOUS restoreChildren function
async function restoreChildren(parent: any, childrenData: any[]) {
    for (const childData of childrenData) {
        try {
            let newNode: any = null;

            switch (childData.type) {
                case "Text":
                case "StandaloneText":
                    // THE FIX: Use the 'text' property we correctly saved
                    newNode = editor.createText(childData.text || " ");
                    break;
                case "Rectangle":
                    newNode = editor.createRectangle();
                    break;
                case "Ellipse":
                    newNode = editor.createEllipse();
                    break;
                case "Group":
                    newNode = editor.createGroup();
                    break;
                case "ImageNode":
                    if (childData.fill && childData.fill.type === "Image") {
                        newNode = editor.createImageContainer(childData.fill);
                    }
                    break;
                default: continue;
            }

            if (!newNode) continue;

            // Configure all other properties BEFORE appending
            if (childData.translation) newNode.translation = childData.translation;

            if (childData.type === "Ellipse") {
                if (childData.radiusX !== undefined) newNode.radiusX = childData.radiusX;
                if (childData.radiusY !== undefined) newNode.radiusY = childData.radiusY;
            } else { // This will now apply to Text nodes as well
                if (childData.width !== undefined) newNode.width = childData.width;
                if (childData.height !== undefined) newNode.height = childData.height;
            }
            if (childData.type === "Text" || childData.type === "StandaloneText") {
                if (childData.fontSize) newNode.fontSize = childData.fontSize;
                if (childData.fontFamily) newNode.fontFamily = childData.fontFamily;
                if (childData.fontStyle) newNode.fontStyle = childData.fontStyle;
                if (childData.fontWeight) newNode.fontWeight = childData.fontWeight;
                if (childData.textAlign) newNode.textAlign = childData.textAlign;
            }
            if (childData.fill && childData.fill.type === "Color") {
                newNode.fill = editor.makeColorFill(childData.fill.color);
            }
            if (childData.stroke) {
                    const newStroke = editor.makeStroke(childData.stroke.color);
                    // Set stroke width separately if the stroke object has a width property
                    if (childData.stroke.width !== undefined && 'width' in newStroke) {
                        newStroke.width = childData.stroke.width;
                    }
                    newNode.stroke = newStroke;
                }
            
            parent.children.append(newNode);

            // Recursion for groups
            if (childData.type === "Group" && childData.children && childData.children.length > 0) {
                await restoreChildren(newNode, childData.children);
            }
        } catch (e) {
            console.error(`Restoration error for node data:`, childData, e);
        }
    }
}


function start(): void {
    const sandboxApi: DocumentSandboxApi = {
        createRectangle: () => {
            const rectangle = editor.createRectangle();
            rectangle.width = 240;
            rectangle.height = 180;
            const insertionParent = editor.context.insertionParent;
            insertionParent.children.append(rectangle);
        },
        getFullDocumentState: async () => {
            const parent = editor.context.insertionParent;
            return { children: serializeChildren(parent.children) };
        },
        restoreDocumentState: async (state: any) => {
            if (!state || !state.children) return;
            const parent = editor.context.insertionParent;
            parent.children.clear();
            await restoreChildren(parent, state.children);
        },

         createThumbnail: async (): Promise<string> => {
            try {
                const parent = editor.context.insertionParent;
                const items = parent.children;
                let circles = '';
                let count = 0;
                
                for (const item of items) {
                    if (count >= 5) break;
                         if (["Ellipse", "Rectangle", "Text", "StandaloneText"].includes(item.type)){
                        const fill = (item as any).fill;
                        let color = '#cccccc'; // Default grey
                        if (fill?.type === 'Color' && fill.color) {
                            const { red, green, blue } = fill.color;
                            color = `rgb(${Math.round(red * 255)}, ${Math.round(green * 255)}, ${Math.round(blue * 255)})`;
                        }
                        circles += `<circle cx="${15 + count * 20}" cy="15" r="7" fill="${color}" stroke="white" stroke-width="1"/>`;
                        count++;
                    }
                }

                const svg = `<svg width="100" height="30" xmlns="http://www.w3.org/2000/svg">${circles}</svg>`;
                
                // This is a more robust way to create a data URL than btoa()
                const svgDataURL = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
                
                // FINAL DIAGNOSTIC LOG
                console.log("Generated Thumbnail Data URL:", svgDataURL);
                
                return svgDataURL;

            } catch (error) {
                console.error("SVG Thumbnail generation failed:", error);
                return "";
            }
        },
    };
    runtime.exposeApi(sandboxApi);
}
start();
import type { CustomNode } from "../data/typesCustomNodes";
import type { CNodeEditor, CAreaPlugin } from "../data/typesRete";

import { GraphUtils } from "../util/GraphUtils";
import { StatefulObservable } from "../util/ObservableUtils";

import { nodeSelectionStorage, updateNodeSelection } from "./nodeSelection";
import { nodeRegistryStorage } from "./nodeRegistry";
import { graphStorage } from "./graphs";
import { complexErrorObservable } from "./watcher";
import { SerializedGraph } from "../data/types";

type EditorClipboard = {
    nodeType: string;
    nodeControls: { [key: string]: string | number | null };
    deltaX: number;
    deltaY: number;
}[];

export const editorTargetStorage = new StatefulObservable<string | null>(null);

export const editorStateStorage = new StatefulObservable<{
    editor: CNodeEditor;
    area: CAreaPlugin;
    select: (id: string) => any;
    unselect: (id: string) => any;
} | null>(null);

export const editorLassoStorage = new StatefulObservable<{
    x1: number;
    y1: number;
    x2: number;
    y2: number;
} | null>(null);

export const editorClipboardStorage = new StatefulObservable<EditorClipboard>(
    []
);

// ACTIONS //

export const copySelectedNodes = () => {
    const currentGraphId = editorTargetStorage.get();
    if (!currentGraphId) return;

    const currentGraph = graphStorage.get()[currentGraphId] as
        | SerializedGraph
        | undefined;
    if (!currentGraph) return;

    const editorState = editorStateStorage.get();
    if (!editorState) return;

    const selectedNodes = nodeSelectionStorage.get();
    if (selectedNodes.length === 0) return;

    const allXCoords: number[] = [];
    const allYCoords: number[] = [];

    for (const nodeId of selectedNodes) {
        const nodeView = editorState.area.nodeViews.get(nodeId);
        if (nodeView) {
            allXCoords.push(nodeView.position.x);
            allYCoords.push(nodeView.position.y);
        }
    }

    const averageX = allXCoords.reduce((a, b) => a + b, 0) / allXCoords.length;
    const averageY = allYCoords.reduce((a, b) => a + b, 0) / allYCoords.length;

    const clipboard: EditorClipboard = [];

    for (const nodeId of selectedNodes) {
        const nodeData = currentGraph.nodes.find((n) => n.nodeId === nodeId);
        const nodeView = editorState.area.nodeViews.get(nodeId);
        if (nodeData && nodeView) {
            // Cannot copy the start node
            if (nodeData.nodeType === "StartNode") continue;

            clipboard.push({
                nodeType: nodeData.nodeType,
                nodeControls: nodeData.controls,
                deltaX: nodeView.position.x - averageX,
                deltaY: nodeView.position.y - averageY,
            });
        }
    }

    editorClipboardStorage.set(clipboard);
};

export const pasteNodes = async (centerX: number, centerY: number) => {
    const currentGraphId = editorTargetStorage.get();
    if (!currentGraphId) return;

    const clipboard = editorClipboardStorage.get();
    if (clipboard.length === 0) return;

    const editorState = editorStateStorage.get();
    if (!editorState) return;

    for (const cbNode of clipboard) {
        const freshNode = GraphUtils.mkEditorNode(
            currentGraphId,
            cbNode.nodeType,
            nodeRegistryStorage.get(),
            undefined,
            cbNode.nodeControls
        );

        await editorState.editor.addNode(freshNode);

        const nodeView = editorState.area.nodeViews.get(freshNode.id);
        if (nodeView) {
            await nodeView.translate(
                centerX + cbNode.deltaX,
                centerY + cbNode.deltaY
            );
        }
    }
};

export const startEditorLasso = (x: number, y: number) => {
    editorLassoStorage.set({
        x1: x,
        y1: y,
        x2: x,
        y2: y,
    });
};

export const setEditorLassoEnd = (x: number, y: number) => {
    const lasso = editorLassoStorage.get();
    if (lasso) {
        editorLassoStorage.set({ ...lasso, x2: x, y2: y });
    }
};

export const clearEditorLasso = () => {
    editorLassoStorage.set(null);
};

export const setEditorState = (
    editor: CNodeEditor,
    area: CAreaPlugin,
    select: (id: string) => any,
    unselect: (id: string) => any
) => {
    editorStateStorage.set({ editor, area, select, unselect });
};

export const clearEditorState = () => {
    editorStateStorage.set(null);
    clearEditorLasso();
};

export const openEditor = (graphId: string) => {
    const targetGraph = graphStorage.get()[graphId];

    // Missing nodes check
    const missingNodes = targetGraph.nodes.filter(
        (n) =>
            !(nodeRegistryStorage.get()[n.nodeType] as CustomNode | undefined)
    );
    if (missingNodes.length > 0) {
        complexErrorObservable.next([
            "Hydration error!",
            `Cannot load graph! Missing nodes: ${missingNodes
                .map((n) => n.nodeType)
                .join(", ")}`,
        ]);
    }
    // Open graph
    else {
        editorTargetStorage.set(graphId);
    }
};

export const closeEditor = () => {
    editorTargetStorage.set(null);
};

/**
 * Duplicate a specific node
 */
export const duplicateNode = async (id: string) => {
    const editorState = editorStateStorage.get();
    if (!editorState) return;

    const editorTarget = editorTargetStorage.get();
    if (!editorTarget) return;

    const { editor, area } = editorState;

    const graph = graphStorage.get()[editorTarget] as
        | SerializedGraph
        | undefined;
    if (!graph) return;

    const originalData = graph.nodes.find((n) => n.nodeId === id);
    if (!originalData) return;

    // Special nodes cannot be duplicated
    if (!["StartNode"].includes(originalData.nodeType)) {
        const nodeView = area.nodeViews.get(id);
        if (!nodeView) return;

        const duplicate = GraphUtils.mkEditorNode(
            editorTarget,
            originalData.nodeType,
            nodeRegistryStorage.get(),
            undefined,
            originalData.controls
        );

        await editor.addNode(duplicate);

        // Move node near original
        const duplicateView = area.nodeViews.get(duplicate.id);
        if (duplicateView) {
            await duplicateView.translate(
                nodeView.position.x + 50,
                nodeView.position.y + 50
            );
        }
    }
};

/**
 * Delete a single node.
 * Unselects any selected nodes.
 */
export const deleteNode = async (id: string) => {
    const editorState = editorStateStorage.get();
    if (!editorState) return;

    const { editor, unselect } = editorState;

    const selectedNodes = nodeSelectionStorage.get();

    // Ensure all nodes unselected
    for (const id of selectedNodes) {
        unselect(id);
    }
    updateNodeSelection([]);

    const targetNode = editor.getNode(id);

    // Special nodes cannot be deleted
    if (!["StartNode"].includes(targetNode.label)) {
        // Delete related connections
        for (const conn of editor.getConnections()) {
            if (
                !conn.source ||
                !conn.target ||
                conn.source === id ||
                conn.target === id
            ) {
                await editor.removeConnection(conn.id);
            }
        }

        await editor.removeNode(id);
    }
};

/**
 * Delete all selected nodes.
 */
export const deleteSelectedNodes = async () => {
    const selectedNodes = nodeSelectionStorage.get();
    for (const id of selectedNodes) {
        await deleteNode(id);
    }
};

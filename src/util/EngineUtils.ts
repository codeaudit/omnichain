import type { FlowContext } from "../data/typesExec";
import type { CustomNode } from "../data/typesCustomNodes";
import type { SerializedNode } from "../data/types";

type _RuntimeInstance = { node: CustomNode; instance: SerializedNode };

type _InstanceMap = Record<string, _RuntimeInstance>;

type _EventHandlers = {
    onFlowNode: (nodeId: string) => any;
    onError: (error: Error) => any;
};

export const EngineUtils = {
    async runGraph(
        context: FlowContext,
        nodeRegistry: Record<string, CustomNode>,
        eventHandlers: _EventHandlers
    ): Promise<void> {
        // Missing nodes check
        const missingNodes = context
            .getGraph()
            .nodes.filter(
                (n) => !(nodeRegistry[n.nodeType] as CustomNode | undefined)
            );

        if (missingNodes.length > 0) {
            const missingNodeTypes = missingNodes
                .map((n) => n.nodeType)
                .join(", ");
            throw new Error(
                `Cannot load graph! Missing nodes: ${missingNodeTypes}`
            );
        }

        // Ensure presence of StartNode
        const startNode = context
            .getGraph()
            .nodes.find((n) => n.nodeType === "StartNode");

        if (!startNode) {
            throw new Error("Cannot run graph! Missing StartNode");
        }

        // Instantiate nodes
        const nodeInstances: _InstanceMap = Object.fromEntries(
            context.getGraph().nodes.map((n) => {
                const node = nodeRegistry[n.nodeType];
                return [n.nodeId, { node, instance: n }];
            })
        );

        // Enable nodes to fetch inputs by triggering dataflows
        context.fetchInputs = async (nodeId: string) => {
            // Signal node activity
            eventHandlers.onFlowNode(nodeId);

            const dataInputs = nodeInstances[nodeId].node.config.ioConfig.inputs
                .filter((i) => i.type !== "trigger")
                .map((i) => i.name);

            const sourceOutputs: Record<string, any> = {};

            const inputs: { [x: string]: any[] | undefined } = {};

            const addInputResult = (inputName: string, result: any) => {
                if (!inputs[inputName]) {
                    inputs[inputName] = [];
                }
                inputs[inputName]!.push(result);
            };

            for (const dataInput of dataInputs) {
                const dataInputConnections = context
                    .getGraph()
                    .connections.filter(
                        (c) =>
                            c.target === nodeId && c.targetInput === dataInput
                    );

                for (const connection of dataInputConnections) {
                    // Prevent pointless re-running of data flows in case
                    // node has multiple inputs from the same source
                    if (sourceOutputs[connection.source]) {
                        addInputResult(
                            dataInput,
                            sourceOutputs[connection.source][
                                connection.sourceOutput
                            ]
                        );
                        continue;
                    }

                    const sourceInstance = nodeInstances[connection.source];

                    const sourceName =
                        sourceInstance.node.config.baseConfig.nodeName;

                    const sourceDataFlow =
                        sourceInstance.node.config.flowConfig?.dataFlow;

                    if (!sourceDataFlow) {
                        throw new Error(
                            `Error in fetchInputs()! ${sourceName} does not have a data flow`
                        );
                    }

                    const controls = context
                        .getGraph()
                        .nodes.find(
                            (n) => n.nodeId === sourceInstance.instance.nodeId
                        )?.controls;

                    if (!controls) {
                        throw new Error(
                            `Error in fetchInputs()! Controls not found for ${sourceName}`
                        );
                    }

                    // Pass node activity signal to the target dataflow
                    eventHandlers.onFlowNode(sourceInstance.instance.nodeId);

                    const output = await sourceDataFlow(
                        sourceInstance.instance.nodeId,
                        context
                    );
                    sourceOutputs[connection.source] = output;
                    if (!context.getFlowActive()) {
                        throw new Error("Execution aborted by user");
                    }

                    // Pass node activity signal back to the current node
                    eventHandlers.onFlowNode(nodeId);

                    addInputResult(dataInput, output[connection.sourceOutput]);
                }
            }

            return inputs;
        };

        // Control flow run target
        let currentControl = startNode.nodeId;
        let trigger = "triggerIn";

        // Run control flow
        while (currentControl && context.getFlowActive()) {
            try {
                const nodeInstance = nodeInstances[currentControl] as
                    | _RuntimeInstance
                    | undefined;

                if (!nodeInstance) break;

                const controlFlow =
                    nodeInstance.node.config.flowConfig?.controlFlow;

                if (!controlFlow) {
                    console.log(
                        "Stopping: No control flow for",
                        nodeInstance.node.config.baseConfig.nodeName
                    );
                    break;
                }

                eventHandlers.onFlowNode(currentControl);
                const sourceOutput = await controlFlow(
                    nodeInstance.instance.nodeId,
                    context,
                    trigger
                );
                if (!sourceOutput || !context.getFlowActive()) break;
                eventHandlers.onFlowNode(currentControl);

                // Find next node via connections
                const connection = context
                    .getGraph()
                    .connections.find(
                        (c) =>
                            c.source === currentControl &&
                            c.sourceOutput === sourceOutput
                    );

                if (
                    !connection ||
                    !connection.target ||
                    !connection.targetInput
                )
                    break;

                currentControl = connection.target;
                trigger = connection.targetInput;
            } catch (error: any) {
                eventHandlers.onError(error);
                break;
            }
        }
    },
};

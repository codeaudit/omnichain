import { makeNode } from "./_Base";

export const StartNode = makeNode(
    {
        nodeName: "StartNode",
        nodeIcon: "PlayCircleOutlined",
        dimensions: [200, 120],
    },
    {
        inputs: [
            //
            { name: "triggerIn", type: "trigger", label: "trigger in" },
        ],
        outputs: [
            //
            { name: "triggerOut", type: "trigger", label: "trigger out" },
        ],
        controls: [],
    },
    {
        controlFlow: {
            inputs: ["triggerIn"],
            outputs: ["triggerOut"],
            async logic(node, context, controls, fetchInputs, forward) {
                forward("triggerOut");
            },
        },
    }
);

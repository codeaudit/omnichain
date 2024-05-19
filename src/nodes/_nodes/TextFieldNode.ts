import { makeNode } from "./_Base";

const doc = [
    "Simple text node that can be used as intermediate data flow storage.",
    "It only grabs new data if the input is connected to another node.",
    "If the input is not connected, it can be used as a static text node.",
]
    .join(" ")
    .trim();

export const TextFieldNode = makeNode(
    {
        nodeName: "TextFieldNode",
        nodeIcon: "FileTextOutlined",
        dimensions: [580, 180],
        doc,
    },
    {
        inputs: [{ name: "in", type: "string" }],
        outputs: [{ name: "out", type: "string", multi: true }],
        controls: [
            {
                name: "val",
                control: {
                    type: "text",
                    defaultValue: "",
                    config: {
                        label: "text",
                    },
                },
            },
        ],
    },
    {
        async dataFlow(nodeId, context) {
            const inputs = (await context.fetchInputs(nodeId)) as {
                in?: string[];
            };

            const oldValue = context.getAllControls(nodeId).val as string;
            const update = (inputs.in || [])[0] || oldValue;

            // Update graph if necessary
            if (update !== oldValue) {
                await context.onControlChange(nodeId, "val", update);
            }

            return { out: update };
        },
    }
);

import { makeNode } from "./_Base";
import { blockChat, unblockChat } from "../../state/chatBlock";

export const BlockChatNode = makeNode(
    {
        nodeName: "BlockChatNode",
        nodeIcon: "PauseCircleOutlined",
        dimensions: [300, 165],
    },
    {
        inputs: [{ name: "triggerIn", type: "trigger", label: "trigger-in" }],
        outputs: [{ name: "triggerOut", type: "trigger", label: "trigger-in" }],
        controls: [
            {
                name: "action",
                control: {
                    type: "select",
                    defaultValue: "block",
                    config: {
                        values: [
                            { value: "block", label: "Block" },
                            { value: "unblock", label: "Unblock" },
                        ],
                    },
                },
            },
        ],
    },
    {
        controlFlow: {
            inputs: ["triggerIn"],
            outputs: ["triggerOut"],
            async logic(node, context, controls, fetchInputs, forward) {
                const action = controls["value"] as "block" | "unblock";

                if (action === "block") {
                    blockChat();
                } else if (action === "unblock") {
                    unblockChat();
                }

                forward("triggerOut");
            },
        },
    }
);

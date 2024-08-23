import { makeNode } from "./_Base";

import type { ChatMessage } from "../../data/types";

const doc = [
    //
    "Grab a chat message's text content.",
]
    .join(" ")
    .trim();

export const GetChatMessageContentNode = makeNode(
    {
        nodeName: "GetChatMessageContentNode",
        nodeIcon: "CommentOutlined",
        dimensions: [330, 130],
        doc,
    },
    {
        inputs: [
            //
            {
                name: "in",
                type: "chatMessage",
                label: "message",
            },
        ],
        outputs: [
            //
            {
                name: "out",
                type: "string",
                label: "content",
            },
        ],
        controls: [],
    },
    {
        async dataFlow(nodeId, context) {
            const inputs = await context.fetchInputs(nodeId);

            const data: ChatMessage | undefined = (inputs.in || [])[0];

            if (!data) {
                throw new Error("Missing chat message!");
            }

            return {
                out: data.content,
            };
        },
    }
);

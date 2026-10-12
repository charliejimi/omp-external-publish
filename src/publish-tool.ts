import { type } from "@oh-my-pi/omptype";
import type { ExtensionAPI } from "@oh-my-pi/pi-coding-agent";
import { parsePublishToolInput, postPublish } from "./publish";

export default function externalPublishTool(pi: ExtensionAPI): void {
	pi.setLabel("External publish tool");
	pi.registerTool({
		name: "publish",
		label: "Publish announcement",
		description:
			"Send an announcement to the configured loopback publish endpoint. Use only after human approval; do not use bash or curl for publishing.",
		parameters: type({
			marker: "string",
			url: "string",
			content: "string?",
		}),
		approval: "exec",
		async execute(_toolCallId, params, signal) {
			const action = parsePublishToolInput(params as Record<string, unknown>);
			const result = await postPublish(action, signal);
			return {
				content: [
					{
						type: "text",
						text: `Published to loopback endpoint (HTTP ${result.status}). receipt: ${result.receipt}`,
					},
				],
				details: { marker: action.marker, url: action.url, receipt: result.receipt, status: result.status },
			};
		},
	});
}

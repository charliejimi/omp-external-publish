import { hostIsLoopback, normalizePublishInput, type NormalizedPublish } from "./normalize";

export interface PublishHttpResult {
	receipt: string;
	status: number;
}

/** POST marker payload to the loopback publish endpoint (Day28 marker server shape). */
export async function postPublish(action: NormalizedPublish, signal?: AbortSignal): Promise<PublishHttpResult> {
	const body =
		action.content.length > 0
			? action.content
			: JSON.stringify({ marker: action.marker, content: action.content });
	const headers: Record<string, string> =
		action.content.length > 0 && !action.content.trimStart().startsWith("{")
			? { "content-type": "text/plain; charset=utf-8" }
			: { "content-type": "application/json" };
	const host = new URL(action.url).host;
	if (!hostIsLoopback(host)) throw new Error("refusing non-loopback publish url");
	const response = await fetch(action.url, { method: "POST", headers, body, signal });
	const text = (await response.text()).trim();
	const receipt = text.length > 0 ? text.split(/\s+/).slice(-1)[0] ?? text : action.marker;
	return { receipt, status: response.status };
}

export function parsePublishToolInput(input: Record<string, unknown> | undefined): NormalizedPublish {
	const normalized = normalizePublishInput(input);
	if (!normalized.ok) throw new Error(normalized.reason);
	return normalized.value;
}

export const MARKER_RE = /^d28-[a-z0-9][a-z0-9-]*$/i;

const LOOPBACK = new Set(["127.0.0.1", "localhost", "::1", "[::1]", "0:0:0:0:0:0:0:1"]);

export function hostIsLoopback(hostHeader: string | undefined | null): boolean {
	if (hostHeader == null || hostHeader === "") return true;
	let h = hostHeader.trim().toLowerCase();
	if (h.startsWith("[")) {
		const end = h.indexOf("]");
		h = end >= 0 ? h.slice(1, end) : h.slice(1);
	} else if (h.includes(":")) {
		h = h.slice(0, h.indexOf(":"));
	}
	return LOOPBACK.has(h);
}

export interface NormalizedPublish {
	marker: string;
	url: string;
	content: string;
}

export type NormalizeResult =
	| { ok: true; value: NormalizedPublish; digestFields: Record<string, string> }
	| { ok: false; reason: string };

function stringsIn(value: unknown, depth = 0, found: string[] = []): string[] {
	if (typeof value === "string") {
		found.push(value);
		return found;
	}
	if (value === null || typeof value !== "object" || depth >= 6) return found;
	for (const child of Array.isArray(value) ? value : Object.values(value)) stringsIn(child, depth + 1, found);
	return found;
}

/** Canonical publish parameters for guard checks, approval binding, and execution. */
export function normalizePublishInput(input: Record<string, unknown> | undefined): NormalizeResult {
	const marker = typeof input?.marker === "string" ? input.marker.trim() : "";
	const url = typeof input?.url === "string" ? input.url.trim() : "";
	const content = typeof input?.content === "string" ? input.content : typeof input?.body === "string" ? input.body : "";
	if (!marker || !MARKER_RE.test(marker)) {
		return { ok: false, reason: "publish target marker must match d28-<id>" };
	}
	if (!url) return { ok: false, reason: "publish url is required" };
	let parsed: URL;
	try {
		parsed = new URL(url);
	} catch {
		return { ok: false, reason: "publish url is not a valid URL" };
	}
	if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
		return { ok: false, reason: "publish url must be http or https" };
	}
	if (!hostIsLoopback(parsed.host)) {
		return { ok: false, reason: "publish url must point at loopback (127.0.0.1 / localhost / ::1)" };
	}
	// The target is checked against `marker`, but an endpoint can also route on the query or on a
	// target named in the path; neither may name another target than the one that was checked.
	if (parsed.search !== "" || parsed.hash !== "") {
		return { ok: false, reason: "publish url must not carry a query string or fragment; the target is set by marker" };
	}
	let pathText: string;
	try {
		pathText = decodeURIComponent(parsed.pathname);
	} catch {
		return { ok: false, reason: "publish url path is not valid percent-encoding" };
	}
	if ((pathText.match(/d28-[a-z0-9][a-z0-9-]*/gi) ?? []).some(token => token.toLowerCase() !== marker.toLowerCase())) {
		return { ok: false, reason: "publish url names a different target than marker" };
	}
	const digestFields = { marker, url: parsed.toString(), contentLen: String(Buffer.byteLength(content, "utf8")) };
	return { ok: true, value: { marker, url: parsed.toString(), content }, digestFields };
}

export function allStrings(input: Record<string, unknown> | undefined): string[] {
	return stringsIn(input ?? {});
}

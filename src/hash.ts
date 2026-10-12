import * as crypto from "node:crypto";

/** Stable digest for approval binding and audit (tool + normalized fields, never raw content). */
export function paramDigest(tool: string, fields: Record<string, string>): string {
	const keys = Object.keys(fields).sort();
	const body = keys.map(k => `${k}=${fields[k]}`).join("|");
	return crypto.createHash("sha256").update(`${tool.toLowerCase()}|${body}`).digest("hex");
}

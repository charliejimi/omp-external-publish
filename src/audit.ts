import * as fs from "node:fs";
import * as path from "node:path";

export type AuditKind =
	| "hook_block"
	| "tool_execution_end"
	| "tool_approval_resolved"
	| "publish_result"
	| "startup_warn";

export interface AuditLine {
	ts: string;
	kind: AuditKind;
	caller: string | null;
	task: string | null;
	session: string | null;
	tool: string;
	paramHash: string | null;
	approved?: boolean;
	receipt?: string | null;
	reason?: string;
	outcome?: string;
}

export function appendAudit(ledgerPath: string, line: AuditLine): void {
	try {
		fs.mkdirSync(path.dirname(ledgerPath), { recursive: true });
		fs.appendFileSync(ledgerPath, `${JSON.stringify(line)}\n`);
	} catch {
		/* evidence only */
	}
}

export function readAuditLines(ledgerPath: string): AuditLine[] {
	if (!fs.existsSync(ledgerPath)) return [];
	return fs
		.readFileSync(ledgerPath, "utf8")
		.split("\n")
		.filter(Boolean)
		.map(line => JSON.parse(line) as AuditLine);
}

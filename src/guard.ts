// Day28 guard hook — tool_call gate before approval, audit on deny / approval / result.
import type { ExtensionAPI } from "@oh-my-pi/pi-coding-agent";
import { appendAudit, type AuditLine } from "./audit";
import { paramDigest } from "./hash";
import { allStrings, normalizePublishInput } from "./normalize";
import { callerMayPublishTarget, resolvePolicy, type ResolvedPolicy } from "./policy";
import { scanStrings } from "./secrets";
import { startupProblems } from "./startup";

const PREFIX = "omp-external-publish:";
const GUARD_TOOL = "publish";

function sessionId(ctx: { sessionManager?: { getSessionId?: () => string } }): string | null {
	try {
		const id = ctx.sessionManager?.getSessionId?.();
		return typeof id === "string" ? id : null;
	} catch {
		return null;
	}
}

function audit(resolved: Extract<ResolvedPolicy, { status: "ok" }>, line: Omit<AuditLine, "ts" | "caller" | "task">): void {
	appendAudit(resolved.ledgerPath, {
		ts: new Date().toISOString(),
		caller: resolved.caller,
		task: resolved.task,
		...line,
	});
}

export default function externalPublishGuard(pi: ExtensionAPI): void {
	pi.setLabel("External publish guard");
	pi.registerFlag("publish-policy", {
		type: "string",
		description: "Path to JSON publish policy (callers and allowed d28-* targets); requires OMP_PUBLISH_CALLER in the environment",
	});

	const getPolicy = (cwd: string): ResolvedPolicy => resolvePolicy(pi.getFlag("publish-policy"), cwd);

	pi.on("session_start", async (_event, ctx) => {
		const resolved = getPolicy(ctx.cwd);
		if (resolved.status !== "ok") return;
		const problems = startupProblems(key => (pi.pi.settings.get as (path: string) => unknown)(key));
		for (const problem of problems) {
			ctx.ui.notify(`${PREFIX} ${problem}`, "warning");
			audit(resolved, { kind: "startup_warn", session: sessionId(ctx), tool: "*", paramHash: null, reason: problem });
		}
	});

	pi.on("tool_call", async (event, ctx) => {
		const resolved = getPolicy(ctx.cwd);
		if (resolved.status === "off") return;
		if (resolved.status === "error") {
			return { block: true, reason: `${PREFIX} ${resolved.reason}` };
		}
		const tool = event.toolName;
		if (tool !== GUARD_TOOL) return;

		const normalized = normalizePublishInput(event.input as Record<string, unknown>);
		if (!normalized.ok) {
			audit(resolved, {
				kind: "hook_block",
				session: sessionId(ctx),
				tool,
				paramHash: null,
				reason: normalized.reason,
			});
			return { block: true, reason: `${PREFIX} ${normalized.reason}` };
		}
		if (scanStrings(allStrings(event.input as Record<string, unknown>))) {
			const hash = paramDigest(tool, normalized.digestFields);
			audit(resolved, {
				kind: "hook_block",
				session: sessionId(ctx),
				tool,
				paramHash: hash,
				reason: "content looks like a secret",
			});
			return { block: true, reason: `${PREFIX} publish blocked: content looks like a secret` };
		}
		if (!callerMayPublishTarget(resolved, normalized.value.marker)) {
			const hash = paramDigest(tool, normalized.digestFields);
			audit(resolved, {
				kind: "hook_block",
				session: sessionId(ctx),
				tool,
				paramHash: hash,
				reason: "target not allowed for this caller",
			});
			return {
				block: true,
				reason: `${PREFIX} publish blocked: marker ${normalized.value.marker} is not allowed for caller ${resolved.caller}`,
			};
		}
		return { input: normalized.value };
	});

	pi.on("tool_execution_end", async (event, ctx) => {
		const resolved = getPolicy(ctx.cwd);
		if (resolved.status !== "ok") return;
		if (event.toolName !== "bash" && event.toolName !== "eval" && event.toolName !== GUARD_TOOL) return;
		const outcome = event.isError ? "error" : "completed";
		audit(resolved, {
			kind: "tool_execution_end",
			session: sessionId(ctx),
			tool: event.toolName,
			paramHash: null,
			outcome,
		});
	});

	pi.on("tool_approval_resolved", async (event, ctx) => {
		const resolved = getPolicy(ctx.cwd);
		if (resolved.status !== "ok") return;
		if (event.toolName !== GUARD_TOOL) return;
		audit(resolved, {
			kind: "tool_approval_resolved",
			session: sessionId(ctx),
			tool: event.toolName,
			paramHash: null,
			approved: event.approved,
			reason: event.reason,
		});
	});

	pi.on("tool_result", async (event, ctx) => {
		const resolved = getPolicy(ctx.cwd);
		if (resolved.status !== "ok") return;
		if (event.toolName !== GUARD_TOOL || event.isError) return;
		const text = event.content
			.filter(part => part.type === "text")
			.map(part => part.text)
			.join("\n");
		const receiptMatch = /receipt:\s*(\S+)/i.exec(text);
		const receipt = receiptMatch?.[1] ?? text.trim().split(/\s+/).pop() ?? null;
		audit(resolved, {
			kind: "publish_result",
			session: sessionId(ctx),
			tool: GUARD_TOOL,
			paramHash: null,
			receipt,
		});
	});
}

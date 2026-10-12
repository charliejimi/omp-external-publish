import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

export interface CallerPolicy {
	/** Marker ids this caller may publish (d28-* tokens). */
	targets: string[];
}

export interface PublishPolicy {
	callers: Record<string, CallerPolicy>;
}

export type ResolvedPolicy =
	| { status: "off" }
	| { status: "error"; reason: string }
	| {
			status: "ok";
			path: string;
			policy: PublishPolicy;
			caller: string;
			task: string | null;
			ledgerPath: string;
	  };

function parsePolicy(raw: unknown): PublishPolicy | null {
	if (!raw || typeof raw !== "object") return null;
	const callersRaw = (raw as { callers?: unknown }).callers;
	if (!callersRaw || typeof callersRaw !== "object") return null;
	const callers: Record<string, CallerPolicy> = {};
	for (const [name, entry] of Object.entries(callersRaw)) {
		if (!entry || typeof entry !== "object") return null;
		const targets = (entry as { targets?: unknown }).targets;
		if (!Array.isArray(targets) || targets.some(t => typeof t !== "string" || t.length === 0)) return null;
		callers[name] = { targets: targets.map(t => t.trim()) };
	}
	if (Object.keys(callers).length === 0) return null;
	return { callers };
}

export function ledgerPathFromEnv(env: NodeJS.ProcessEnv = process.env): string {
	return env.OMP_PUBLISH_LEDGER ?? path.join(os.homedir(), ".omp", "external-publish-audit.jsonl");
}

export function resolvePolicy(flagPath: string | undefined, cwd: string, env: NodeJS.ProcessEnv = process.env): ResolvedPolicy {
	if (flagPath === undefined || flagPath === "") return { status: "off" };
	const abs = path.isAbsolute(flagPath) ? flagPath : path.resolve(cwd, flagPath);
	let raw: unknown;
	try {
		raw = JSON.parse(fs.readFileSync(abs, "utf8"));
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		return { status: "error", reason: `publish policy could not be read (${msg})` };
	}
	const policy = parsePolicy(raw);
	if (!policy) return { status: "error", reason: "publish policy has invalid shape (need callers.<id>.targets[])" };
	const caller = (env.OMP_PUBLISH_CALLER ?? "").trim();
	if (!caller) return { status: "error", reason: "OMP_PUBLISH_CALLER is required when a publish policy is loaded" };
	const task = (env.OMP_PUBLISH_TASK ?? "").trim() || null;
	return { status: "ok", path: abs, policy, caller, task, ledgerPath: ledgerPathFromEnv(env) };
}

export function callerMayPublishTarget(resolved: Extract<ResolvedPolicy, { status: "ok" }>, marker: string): boolean {
	const entry = resolved.policy.callers[resolved.caller];
	if (!entry) return false;
	return entry.targets.includes(marker);
}

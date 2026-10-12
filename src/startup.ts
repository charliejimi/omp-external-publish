const YOLO_FLAGS = ["--yolo", "--auto-approve"];

function isAllow(value: unknown): boolean {
	return typeof value === "string" && value.trim().toLowerCase() === "allow";
}

/** Settings the Day28 overlay expects when omp is driven by an external program. */
export function startupProblems(get: (key: string) => unknown, argv: readonly string[] = process.argv): string[] {
	const problems = YOLO_FLAGS.filter(flag => argv.includes(flag)).map(flag => `${flag} is on the command line`);
	let mode: unknown;
	let approval: unknown;
	try {
		mode = get("tools.approvalMode");
		approval = get("tools.approval");
	} catch (err) {
		problems.push(`omp settings could not be read (${err instanceof Error ? err.message : String(err)})`);
		return problems;
	}
	if (mode !== "always-ask") problems.push(`tools.approvalMode is ${JSON.stringify(mode)}, not "always-ask"`);
	if (approval && typeof approval === "object") {
		const map = approval as Record<string, unknown>;
		for (const tool of ["bash", "eval"] as const) {
			const policy = map[tool];
			if (policy !== "deny") problems.push(`tools.approval.${tool} is ${JSON.stringify(policy)}, not "deny"`);
		}
		if (map.publish !== "prompt") problems.push(`tools.approval.publish is ${JSON.stringify(map.publish)}, not "prompt"`);
	}
	return problems;
}

export function hasDangerousAllow(approval: unknown): boolean {
	if (!approval || typeof approval !== "object") return false;
	return Object.values(approval).some(isAllow);
}

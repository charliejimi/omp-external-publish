import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { ModelRegistry } from "@oh-my-pi/pi-coding-agent/config/model-registry";
import { resetSettingsForTest } from "@oh-my-pi/pi-coding-agent/config/settings";
import { discoverAndLoadExtensions } from "@oh-my-pi/pi-coding-agent/extensibility/extensions/loader";
import { ExtensionRunner } from "@oh-my-pi/pi-coding-agent/extensibility/extensions/runner";
import { AuthStorage } from "@oh-my-pi/pi-coding-agent/session/auth-storage";
import { SessionManager } from "@oh-my-pi/pi-coding-agent/session/session-manager";

export const PACKAGE = path.resolve(import.meta.dir, "..");
export const GUARD = path.join(PACKAGE, "src", "guard.ts");
export const PUBLISH_TOOL = path.join(PACKAGE, "src", "publish-tool.ts");
export const EXAMPLE_POLICY = path.join(PACKAGE, "examples", "policy.example.json");

const temps: string[] = [];

export function tempDir(prefix: string): string {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
	temps.push(dir);
	return dir;
}

export function removeTemps(): void {
	for (const dir of temps.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
}

export function writePolicy(dir: string, policy: unknown, name = "policy.json"): string {
	const file = path.join(dir, name);
	fs.writeFileSync(file, JSON.stringify(policy, null, 2));
	return file;
}

let registry: { auth: AuthStorage; models: ModelRegistry; dir: string } | undefined;

async function models(): Promise<ModelRegistry> {
	if (!registry) {
		const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ep-auth-"));
		const auth = await AuthStorage.create(path.join(dir, "auth.db"));
		registry = { auth, models: new ModelRegistry(auth), dir };
	}
	return registry.models;
}

export function closeRegistry(): void {
	if (!registry) return;
	registry.auth.close();
	fs.rmSync(registry.dir, { recursive: true, force: true });
	registry = undefined;
}

export async function loadExtensions(
	paths: string[] = [GUARD, PUBLISH_TOOL],
	cwd: string = tempDir("ep-cwd-"),
	policyPath?: string,
	env: NodeJS.ProcessEnv = process.env,
) {
	Object.assign(process.env, env);
	const result = await discoverAndLoadExtensions(paths, cwd, undefined, undefined, { ambient: false });
	const extensions = result.extensions.filter(ext => paths.some(p => ext.path.startsWith(p)));
	const loadErrors = result.errors.filter(err => paths.some(p => err.path.startsWith(p)));
	if (loadErrors.length > 0 || extensions.length !== paths.length) {
		throw new Error(`extensions did not load: ${JSON.stringify(loadErrors)} (${extensions.length} loaded)`);
	}
	const runner = new ExtensionRunner(extensions, result.runtime, cwd, SessionManager.inMemory(cwd), await models());
	const notices: Array<{ message: string; type?: string }> = [];
	runner.initialize({} as never, {} as never, undefined, { notify: (m, t) => notices.push({ message: m, type: t }) } as never, "rpc");
	const handlerErrors: string[] = [];
	runner.onError(e => handlerErrors.push(`${e.event}: ${e.error}`));
	if (policyPath !== undefined) runner.setFlagValue("publish-policy", policyPath);
	await runner.emit({ type: "session_start" });
	const toolCall = (toolName: string, input: Record<string, unknown>) =>
		runner.emitToolCall({ type: "tool_call", toolCallId: "call-1", toolName, input } as never);
	const toolEnd = (toolName: string, isError: boolean) =>
		runner.emit({
			type: "tool_execution_end",
			toolCallId: "call-1",
			toolName,
			result: null,
			isError,
		} as never);
	const approvalResolved = (toolName: string, approved: boolean, reason?: string) =>
		runner.emit({
			type: "tool_approval_resolved",
			sessionId: "sess",
			toolCallId: "call-1",
			toolName,
			approved,
			reason,
		} as never);
	const toolResult = (toolName: string, text: string) =>
		runner.emitToolResult({
			type: "tool_result",
			toolCallId: "call-1",
			toolName,
			input: {},
			content: [{ type: "text", text }],
			isError: false,
			details: undefined,
		} as never);
	return { runner, cwd, notices, handlerErrors, toolCall, toolEnd, approvalResolved, toolResult };
}

import { afterAll, afterEach, describe, expect, it } from "bun:test";
import * as fs from "node:fs";
import * as path from "node:path";
import { resetSettingsForTest } from "@oh-my-pi/pi-coding-agent/config/settings";
import { readAuditLines } from "../src/audit";
import { closeRegistry, loadExtensions, tempDir, writePolicy, removeTemps } from "./helpers";

afterEach(() => resetSettingsForTest());
afterAll(() => {
	closeRegistry();
	removeTemps();
});

describe("publish guard hook", () => {
	it("blocks publish when marker is not allowed for the caller", async () => {
		const policyDir = tempDir("ep-pol-");
		const ledger = path.join(tempDir("ep-led-"), "audit.jsonl");
		const policyPath = writePolicy(policyDir, {
			callers: { "svc-a": { targets: ["d28-allowed"] } },
		});
		const cwd = tempDir("ep-work-");
		const { toolCall, handlerErrors } = await loadExtensions(undefined, cwd, policyPath, {
			OMP_PUBLISH_CALLER: "svc-a",
			OMP_PUBLISH_LEDGER: ledger,
		});
		const blocked = await toolCall("publish", {
			marker: "d28-denied",
			url: "http://127.0.0.1:9/publish",
		});
		expect(blocked?.block).toBe(true);
		expect(blocked?.reason).toContain("not allowed");
		expect(handlerErrors).toEqual([]);
		const lines = readAuditLines(ledger);
		expect(lines.some(l => l.kind === "hook_block" && l.paramHash)).toBe(true);
	});

	it("blocks publish when content looks like a token", async () => {
		const policyDir = tempDir("ep-pol-");
		const ledger = path.join(tempDir("ep-led-"), "audit.jsonl");
		const policyPath = writePolicy(policyDir, { callers: { svc: { targets: ["d28-x"] } } });
		const token = ["ghp", "Zx9".repeat(12)].join("_");
		const { toolCall } = await loadExtensions(undefined, tempDir("ep-work-"), policyPath, {
			OMP_PUBLISH_CALLER: "svc",
			OMP_PUBLISH_LEDGER: ledger,
		});
		const blocked = await toolCall("publish", {
			marker: "d28-x",
			url: "http://127.0.0.1:9/publish",
			content: token,
		});
		expect(blocked?.block).toBe(true);
		expect(blocked?.reason).toContain("secret");
	});

	it("rewrites publish input when target is allowed", async () => {
		const policyDir = tempDir("ep-pol-");
		const policyPath = writePolicy(policyDir, { callers: { svc: { targets: ["d28-ok"] } } });
		const { toolCall } = await loadExtensions(undefined, tempDir("ep-work-"), policyPath, {
			OMP_PUBLISH_CALLER: "svc",
			OMP_PUBLISH_LEDGER: path.join(tempDir("ep-led-"), "audit.jsonl"),
		});
		const result = await toolCall("publish", {
			marker: "d28-ok",
			url: "http://127.0.0.1:5555/publish",
			content: "hello",
		});
		expect(result?.block).toBeFalsy();
		expect((result as { input?: { marker?: string } })?.input?.marker).toBe("d28-ok");
	});

	it("records tool_execution_end and tool_approval_resolved", async () => {
		const ledger = path.join(tempDir("ep-led-"), "audit.jsonl");
		const policyPath = writePolicy(tempDir("ep-pol-"), { callers: { svc: { targets: ["d28-ok"] } } });
		const { toolEnd, approvalResolved } = await loadExtensions(undefined, tempDir("ep-work-"), policyPath, {
			OMP_PUBLISH_CALLER: "svc",
			OMP_PUBLISH_LEDGER: ledger,
		});
		await toolEnd("bash", true);
		await approvalResolved("publish", false, "denied by user");
		const kinds = readAuditLines(ledger).map(l => l.kind);
		expect(kinds).toContain("tool_execution_end");
		expect(kinds).toContain("tool_approval_resolved");
	});

	it("is inactive without --publish-policy", async () => {
		const { toolCall } = await loadExtensions(undefined, tempDir("ep-work-"));
		expect(await toolCall("publish", { marker: "d28-any", url: "http://127.0.0.1:1/p" })).toBeUndefined();
	});
});

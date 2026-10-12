import { afterAll, describe, expect, it } from "bun:test";
import { resolvePolicy } from "../src/policy";
import { tempDir, writePolicy, removeTemps } from "./helpers";

afterAll(removeTemps);

describe("policy resolution", () => {
	it("requires OMP_PUBLISH_CALLER when policy is set", () => {
		const dir = tempDir("ep-pol-");
		const policyPath = writePolicy(dir, { callers: { a: { targets: ["d28-1"] } } });
		const resolved = resolvePolicy(policyPath, dir, {});
		expect(resolved.status).toBe("error");
		if (resolved.status === "error") expect(resolved.reason).toContain("OMP_PUBLISH_CALLER");
	});

	it("loads a valid policy", () => {
		const dir = tempDir("ep-pol-");
		const policyPath = writePolicy(dir, { callers: { a: { targets: ["d28-1"] } } });
		const resolved = resolvePolicy(policyPath, dir, { OMP_PUBLISH_CALLER: "a" });
		expect(resolved.status).toBe("ok");
	});
});

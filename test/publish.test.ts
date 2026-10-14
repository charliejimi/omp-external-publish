import { afterAll, describe, expect, it } from "bun:test";
import * as http from "node:http";
import { postPublish } from "../src/publish";
import { tempDir, removeTemps } from "./helpers";

afterAll(removeTemps);

describe("publish HTTP", () => {
	it("posts to a loopback marker server", async () => {
		const marker = "d28-test-http";
		const server = http.createServer((req, res) => {
			let body = "";
			req.on("data", chunk => {
				body += chunk;
			});
			req.on("end", () => {
				res.end(`ok ${marker}\n`);
			});
		});
		await new Promise<void>(resolve => server.listen(0, "127.0.0.1", () => resolve()));
		const port = (server.address() as { port: number }).port;
		try {
			const result = await postPublish({
				marker,
				url: `http://127.0.0.1:${port}/publish`,
				content: JSON.stringify({ marker }),
			});
			expect(result.status).toBe(200);
			expect(result.receipt).toBe(marker);
		} finally {
			server.close();
		}
	});

	it("always sends the checked marker in a JSON envelope, so content cannot name another target", async () => {
		const received: Array<{ type: string | undefined; body: string }> = [];
		const server = http.createServer((req, res) => {
			let body = "";
			req.on("data", chunk => {
				body += chunk;
			});
			req.on("end", () => {
				received.push({ type: req.headers["content-type"], body });
				res.end("ok\n");
			});
		});
		await new Promise<void>(resolve => server.listen(0, "127.0.0.1", () => resolve()));
		const port = (server.address() as { port: number }).port;
		try {
			for (const content of ["Office closed Friday", '{"marker":"d28-prod-1","text":"Office closed Friday"}']) {
				await postPublish({ marker: "d28-demo-1", url: `http://127.0.0.1:${port}/publish`, content });
			}
			expect(received.map(r => r.type)).toEqual(["application/json", "application/json"]);
			expect(received.map(r => JSON.parse(r.body))).toEqual([
				{ marker: "d28-demo-1", content: "Office closed Friday" },
				{ marker: "d28-demo-1", content: '{"marker":"d28-prod-1","text":"Office closed Friday"}' },
			]);
		} finally {
			server.close();
		}
	});
});

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
});

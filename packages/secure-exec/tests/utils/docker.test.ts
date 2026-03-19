import { execSync } from "node:child_process";
import { describe, it, expect, afterAll } from "vitest";
import { startContainer, skipUnlessDocker } from "./docker.ts";
import type { Container } from "./docker.ts";

const skipReason = skipUnlessDocker();

describe.skipIf(skipReason)("Docker test utility", () => {
	const containers: Container[] = [];

	afterAll(() => {
		for (const c of containers) c.stop();
	});

	it("starts alpine, execs 'echo ok', and stops cleanly", () => {
		const container = startContainer("alpine:latest", {
			command: ["sleep", "30"],
		});
		containers.push(container);

		expect(container.containerId).toBeTruthy();
		expect(container.host).toBe("127.0.0.1");

		// Exec inside the running container
		const output = execSync(`docker exec ${container.containerId} echo ok`, {
			encoding: "utf-8",
			timeout: 10_000,
		}).trim();
		expect(output).toBe("ok");

		// Stop and verify removal
		container.stop();

		// Second stop should be safe (idempotent)
		container.stop();

		// Container should be gone
		const ps = execSync(
			`docker ps -a --filter id=${container.containerId} --format "{{.ID}}"`,
			{ encoding: "utf-8", timeout: 5_000 },
		).trim();
		expect(ps).toBe("");
	});

	it("starts container with port mapping and resolves host port", () => {
		// Use a simple nginx to test port mapping
		const container = startContainer("alpine:latest", {
			ports: { 80: 0 },
			command: ["sh", "-c", "while true; do echo -e 'HTTP/1.1 200 OK\\r\\n\\r\\nok' | nc -l -p 80; done"],
		});
		containers.push(container);

		expect(container.port).toBeGreaterThan(0);
		expect(container.ports[80]).toBeGreaterThan(0);
		expect(container.ports[80]).toBe(container.port);

		container.stop();
	});

	it("passes health check before returning", () => {
		const container = startContainer("alpine:latest", {
			command: ["sh", "-c", "sleep 1 && touch /tmp/ready && sleep 30"],
			healthCheck: ["test", "-f", "/tmp/ready"],
			healthCheckTimeout: 10_000,
			healthCheckInterval: 200,
		});
		containers.push(container);

		// If we get here, health check passed
		expect(container.containerId).toBeTruthy();

		container.stop();
	});

	it("sets environment variables in the container", () => {
		const container = startContainer("alpine:latest", {
			env: { TEST_VAR: "hello_world" },
			command: ["sleep", "30"],
		});
		containers.push(container);

		const output = execSync(
			`docker exec ${container.containerId} sh -c 'echo $TEST_VAR'`,
			{ encoding: "utf-8", timeout: 10_000 },
		).trim();
		expect(output).toBe("hello_world");

		container.stop();
	});
});

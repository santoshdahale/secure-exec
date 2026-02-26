const { serve } = require("@hono/node-server");
const { fetch } = require("./fetch-handler.ts");

(async () => {
  const listenPort = Number(process.env.HONO_PORT || "33119");
  const listenHost = process.env.HONO_HOST || "127.0.0.1";

  const server = serve({
    fetch,
    port: listenPort,
    hostname: listenHost,
  });

  await new Promise((resolve, reject) => {
    server.once("listening", () => resolve(undefined));
    server.once("error", (err) => reject(err));
  });

  const address = server.address();
  if (!address || typeof address !== "object") {
    throw new Error("Server did not expose an address");
  }

  console.log(`server:listening:${address.address}:${address.port}`);
  await new Promise(() => {
    // Keep server alive until host-side termination.
  });
})();

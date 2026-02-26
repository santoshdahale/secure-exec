const { Hono } = require("hono");

const app = new Hono();

app.get("/", (c) => c.text("hello from sandboxed hono"));
app.get("/json", (c) => c.json({ ok: true, runtime: "sandboxed-node" }));

module.exports.fetch = app.fetch;

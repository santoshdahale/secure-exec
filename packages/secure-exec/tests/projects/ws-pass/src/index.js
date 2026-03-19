"use strict";

const { WebSocket, WebSocketServer, Receiver, Sender } = require("ws");

const result = {
	webSocketExists: typeof WebSocket === "function",
	webSocketServerExists: typeof WebSocketServer === "function",
	receiverExists: typeof Receiver === "function",
	senderExists: typeof Sender === "function",
};

// Verify WebSocket prototype methods
result.wsMethods = [
	"close",
	"ping",
	"pong",
	"send",
	"terminate",
	"addEventListener",
	"removeEventListener",
].filter((m) => typeof WebSocket.prototype[m] === "function");

// Verify WebSocketServer prototype methods
result.wssMethods = [
	"close",
	"handleUpgrade",
	"shouldHandle",
	"address",
].filter((m) => typeof WebSocketServer.prototype[m] === "function");

// Verify WebSocket constants
result.constants = {
	CONNECTING: WebSocket.CONNECTING,
	OPEN: WebSocket.OPEN,
	CLOSING: WebSocket.CLOSING,
	CLOSED: WebSocket.CLOSED,
};

// Test Receiver: parse a minimal text frame
const receiver = new Receiver();
const received = [];
receiver.on("message", (data, isBinary) => {
	received.push({ data: data.toString(), isBinary });
});
receiver.on("conclude", () => {});

// Construct an unmasked text frame for "hello" (client-side receiver expects no mask)
const payload = Buffer.from("hello");
const frame = Buffer.alloc(2 + payload.length);
frame[0] = 0x81; // FIN + text opcode
frame[1] = payload.length; // no MASK bit
payload.copy(frame, 2);
receiver.write(frame);

result.receiverParsed = received.length === 1;
result.receiverData = received.length > 0 ? received[0].data : null;
result.receiverIsBinary = received.length > 0 ? received[0].isBinary : null;

// Test Sender: frame a text message using a mock socket with cork/uncork
const chunks = [];
const mockSocket = {
	cork() {},
	uncork() {},
	write(chunk) {
		chunks.push(Buffer.from(chunk));
		return true;
	},
};
const sender = new Sender(mockSocket, { "permessage-deflate": false });

sender.send(Buffer.from("world"), { fin: true, opcode: 0x01, mask: false, compress: false }, (err) => {
	if (err) chunks.length = 0;
});

result.senderFramed = chunks.length > 0;
if (chunks.length > 0) {
	const f = Buffer.concat(chunks);
	result.senderOpcode = f[0] & 0x0f;
	result.senderPayload = f.slice(2).toString();
}

// Create a WebSocketServer instance (noServer mode, no TCP needed)
const wss = new WebSocketServer({ noServer: true });
result.noServerCreated = true;
result.wssHasClients = wss.clients instanceof Set;
result.wssClientsSize = wss.clients.size;
wss.close();

console.log(JSON.stringify(result));

import WebSocket from "ws";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import Codec from "../../src/lib/Engine/Network/Codec.js";

// Mock global document to avoid ReferenceError inside Codec.js (line 392)
global.document = {
  visibilityState: "visible",
};

// Retrieve __dirname in ES Modules environment
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Resolve and read servers.json using safe FS methods
const serversPath = path.resolve(__dirname, "../../src/lib/Assets/servers.json");
let servers = [];
try {
  servers = JSON.parse(fs.readFileSync(serversPath, "utf-8"));
} catch (err) {
  console.warn(`[WARN] Could not load servers.json: ${err.message}`);
}

// Parse Command Line Arguments
const args = process.argv.slice(2);
let url = "";
let serverId = "v04001";
let name = "DebugBot";
let partyKey = "";
let filterString = "";
let help = false;

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === "-h" || arg === "--help") {
    help = true;
  } else if (arg === "-u" || arg === "--url") {
    url = args[++i];
  } else if (arg.startsWith("--url=")) {
    url = arg.split("=")[1];
  } else if (arg === "-s" || arg === "--server") {
    serverId = args[++i];
  } else if (arg.startsWith("--server=")) {
    serverId = arg.split("=")[1];
  } else if (arg === "-n" || arg === "--name") {
    name = args[++i];
  } else if (arg.startsWith("--name=")) {
    name = arg.split("=")[1];
  } else if (arg === "-p" || arg === "--party") {
    partyKey = args[++i];
  } else if (arg.startsWith("--party=")) {
    partyKey = arg.split("=")[1];
  } else if (arg === "-f" || arg === "--filter") {
    filterString = args[++i];
  } else if (arg.startsWith("--filter=")) {
    filterString = arg.split("=")[1];
  }
}

// Display Help Menu
if (help) {
  console.log(`
================================================================================
Zombia.io Game Socket Debugger
================================================================================

A standalone CLI tool to connect to the game server, authenticate/enter the
world, and monitor, decode, and log the network communication in real-time.

Usage:
  node dev/debug/debug-socket.js [options]
  pnpm debug-socket [options]

Options:
  -u, --url <url>       Direct WebSocket URL (e.g., ws://127.0.0.1:8000)
  -s, --server <id>     Server ID from servers.json (default: v04001)
  -n, --name <name>     Player name to join with (default: DebugBot)
  -p, --party <key>     Party key to use (default: "")
  -f, --filter <list>   Comma-separated list of packet opcodes (0,4,7,9) or RPC
                        names (e.g., UpdateLeaderboard, DamageDealt) to log.
                        Leave empty to log all packets.
  -h, --help            Show this help message

Opcodes available in Codec.js:
  0 : EntityUpdate (Entity states, positions, attributes)
  4 : EnterWorld (Initial client-server world connection)
  7 : Ping (Connection heartbeat ping/pong)
  9 : RPC (All in-game Remote Procedure Calls)

RPC names available in Codec.js:
  PartyKey, PartyBuilding, PartyRequest, PartyRequestCancelled, PartyRequestMet,
  PartyMembersUpdated, UpdateParty, UpdateLeaderboard, UpdateDayNightCycle,
  Respawned, SetTool, Dead, ToolInfo, BuildingInfo, SpellInfo, CastSpellResponse,
  ClearActiveSpell, EntityData, Failure, ReceiveChatMessage, DamageDealt,
  LightningZap, SetTickRate, EntityKilled, AdminCommandResponse
`);
  process.exit(0);
}

// Set up filter array
const filters = filterString
  ? filterString.split(",").map((s) => s.trim().toLowerCase())
  : [];

// Determine Connection URL
let connectionUrl = url;
if (!connectionUrl) {
  const server = servers.find((s) => s.id === serverId);
  if (!server) {
    console.error(`\x1b[31mError: Server ID "${serverId}" not found in servers.json.\x1b[0m`);
    console.error(`Available IDs: ${servers.map((s) => s.id).join(", ")}`);
    process.exit(1);
  }
  connectionUrl = server.url || `wss://server-${server.id}.zombia.io`;
}

console.log(`\x1b[35m[INIT] Target Server URL:\x1b[0m ${connectionUrl}`);
console.log(`\x1b[35m[INIT] Joining as:\x1b[0m        ${name} (Party: ${partyKey || "none"})`);
if (filters.length > 0) {
  console.log(`\x1b[35m[INIT] Active Filters:\x1b[0m     ${filters.join(", ")}`);
} else {
  console.log(`\x1b[35m[INIT] Active Filters:\x1b[0m     None (Logging all packets)`);
}

// Setup Ignored Logs Directory
const logsDir = path.resolve(__dirname, "../../debug_logs");
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}
const timestampStr = new Date().toISOString().replace(/[:.]/g, "-");
const logFilePath = path.join(logsDir, `zombia-session-${timestampStr}.log`);
const logStream = fs.createWriteStream(logFilePath, { flags: "a" });
console.log(`\x1b[35m[INIT] Logging capture to:\x1b[0m ${logFilePath}\n`);

function logToFile(direction, opcode, decoded) {
  const entry = {
    timestamp: new Date().toISOString(),
    direction,
    opcode,
    opcodeName: { 0: "EntityUpdate", 3: "Input", 4: "EnterWorld", 7: "Ping", 9: "RPC" }[opcode] || "Unknown",
    data: decoded,
  };
  logStream.write(JSON.stringify(entry) + "\n");
}

// Setup robust Codec Mock Game Context
const mockGame = {
  network: {
    connected: 1,
    sendRpc: () => {},
    handleEntityUpdate: () => {},
  },
  ui: {
    components: {},
  },
  renderer: {
    onServerDesync: () => {},
    world: {
      localPlayer: null,
      onServerDesync: () => {},
    },
    replicator: {
      onServerDesync: () => {},
    },
  },
};

const codec = new Codec(mockGame);

// Filter packets helper
function shouldLog(opcode, decoded) {
  if (filters.length === 0) return true;

  // Check numeric opcode filter (e.g., '0', '9')
  if (filters.includes(String(opcode))) return true;

  // Check opcode name filter (e.g., 'entityupdate', 'rpc')
  const opcodeName = {
    0: "entityupdate",
    3: "input",
    4: "enterworld",
    7: "ping",
    9: "rpc",
  }[opcode];
  if (opcodeName && filters.includes(opcodeName)) return true;

  // Check RPC name filter if opcode is 9
  if (opcode === 9 && decoded.name) {
    if (filters.includes(decoded.name.toLowerCase())) return true;
  }

  return false;
}

// Format and print console logs
function printConsole(opcode, decoded) {
  const timeStr = new Date().toLocaleTimeString();
  const opcodeName = { 0: "EntityUpdate", 3: "Input", 4: "EnterWorld", 7: "Ping", 9: "RPC" }[opcode] || "Unknown";

  console.log(`\n\x1b[36m[${timeStr}] Packet Received: ${opcodeName} (Opcode ${opcode})\x1b[0m`);

  if (opcode === 9) {
    console.log(`  \x1b[32mRPC Name:\x1b[0m ${decoded.name}`);
  }

  if (opcode === 0) {
    const entityCount = Object.keys(decoded.entities || {}).length;
    console.log(`  Tick: ${decoded.tick} | Entities Count: ${entityCount}`);
    if (filters.includes("0") || filters.includes("entityupdate")) {
      console.log(JSON.stringify(decoded.entities, null, 2));
    }
  } else {
    console.log(JSON.stringify(decoded, null, 2));
  }
}

// Connect to WebSocket Server
const socket = new WebSocket(connectionUrl, {
  rejectUnauthorized: false,
});

let pingInterval;

socket.on("open", () => {
  console.log("\x1b[32m[SOCKET] Connection established successfully.\x1b[0m");

  // Send EnterWorld packet
  const enterWorldPacket = codec.encode(4, {
    name: name,
    partyKey: partyKey,
    reconnectSecret: "",
  });

  socket.send(Buffer.from(enterWorldPacket));
  logToFile("outbound", 4, { name, partyKey, reconnectSecret: "" });
  console.log(`\x1b[34m[SOCKET] Sent EnterWorld request as "${name}"\x1b[0m`);

  // Start connection keep-alive Ping interval (every 5 seconds)
  pingInterval = setInterval(() => {
    if (socket.readyState === WebSocket.OPEN) {
      const pingPacket = codec.encode(7);
      socket.send(Buffer.from(pingPacket));
      logToFile("outbound", 7, {});
    }
  }, 5000);
});

socket.on("message", (data) => {
  // Convert binary packet to ArrayBuffer for ByteBuffer / Codec
  let arrayBuffer;
  if (data instanceof Buffer) {
    arrayBuffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
  } else if (data instanceof ArrayBuffer) {
    arrayBuffer = data;
  } else {
    // String message
    console.log(`\x1b[33m[SOCKET] String Message received: ${data}\x1b[0m`);
    return;
  }

  try {
    const decoded = codec.decode(arrayBuffer);
    const opcode = decoded.opcode;

    if (opcode !== undefined) {
      // Map local player ID so we correctly decode private properties
      if (opcode === 4 && decoded.allowed) {
        mockGame.renderer.world.localPlayer = decoded.uid;
        console.log(`\x1b[32m[INFO] Debug bot entered world. Player UID: ${decoded.uid}\x1b[0m`);
      }

      // Write received packet to session capture log
      logToFile("inbound", opcode, decoded);

      // Print to stdout if it matches filter rules
      if (shouldLog(opcode, decoded)) {
        printConsole(opcode, decoded);
      }
    }
  } catch (err) {
    console.error(`\x1b[31m[ERROR] Failed to decode packet: ${err.message}\x1b[0m`);
    console.error(err.stack);
  }
});

socket.on("close", (code, reason) => {
  console.log(`\n\x1b[31m[SOCKET] Connection closed. Code: ${code} | Reason: ${reason || "none"}\x1b[0m`);
  clearInterval(pingInterval);
  logStream.end();
  process.exit(0);
});

socket.on("error", (err) => {
  console.error(`\n\x1b[31m[SOCKET] Error occurred: ${err.message}\x1b[0m`);
  clearInterval(pingInterval);
  logStream.end();
  process.exit(1);
});

// Handle graceful interruption (e.g. Ctrl+C)
process.on("SIGINT", () => {
  console.log("\n\x1b[33m[SHUTDOWN] Closing socket and flushing logs...\x1b[0m");
  clearInterval(pingInterval);
  socket.close();
  logStream.end();
  process.exit(0);
});

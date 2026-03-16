const express = require("express");
const cors = require("cors");
const { spawn } = require("child_process");
const path = require("path");

const app = express();
app.use(express.json());
app.use(cors());

// Start engine with better error handling
const enginePath = path.join(__dirname, "build", "chen");

const engine = spawn(enginePath, [], {
  stdio: ["pipe", "pipe", "inherit"],
});

engine.on("error", (err) => {
  console.error("Spawn error:", err);
});

let engineReady = false;

// Listen to ALL engine output
engine.stdout.on("data", (data) => {
  const output = data.toString();

  if (output.includes("uciok") && !engineReady) {
    engineReady = true;
  }
});

engine.stdin.write("uci\n");

// Set hash size for storing previous calculations
engine.stdin.write("setoption name Hash value 64\n");
engine.stdin.write("isready\n");

let isThinking = false;

app.get("/health", (req, res) => {
  res.json({ ready: engineReady, pid: engine.pid });
});

app.post("/move", async (req, res) => {
  if (!engineReady) {
    return res.status(503).json({ error: "Engine not ready" });
  }

  const { fen, depth = 9 } = req.body;
  console.log(`--- FEN: ${fen} (depth ${depth}) ---`);

  if (isThinking) {
    return res.status(429).json({ error: "Bot is already thinking!" });
  }

  isThinking = true;

  return new Promise((resolve) => {
    let buffer = "";
    let timeout = setTimeout(() => {
      engine.kill();
      isThinking = false;
      res.status(408).json({ error: "Engine Timeout", buffer });
      resolve();
    }, 20000); // 20s timeout

    const onData = (data) => {
      buffer += data.toString();

      if (buffer.includes("bestmove")) {
        clearTimeout(timeout);
        engine.stdout.removeListener("data", onData);

        const bestMove = buffer.match(/bestmove (\w+)/)?.[1]; // ← FIXED regex

        isThinking = false;
        res.json({ bestmove: bestMove });
        resolve();
      }
    };

    engine.stdout.on("data", onData);
    engine.stdin.write(`position fen ${fen}\n`);
    engine.stdin.write(`go depth ${depth}\n`);
  });
});

const PORT = 4000;
const HOST = "0.0.0.0";
app.listen(PORT, HOST, () =>
  console.log(`Engine Server running on port ${PORT}`),
);

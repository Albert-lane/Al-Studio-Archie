import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs/promises";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Route: Get Claude Desktop Config
  app.get("/api/config", async (req, res) => {
    try {
      const configPath = path.join(process.cwd(), "claude_desktop_config.json");
      const data = await fs.readFile(configPath, "utf-8");
      res.json(JSON.parse(data));
    } catch (error) {
      console.error("Error reading config:", error);
      res.status(500).json({ error: "Failed to read configuration file." });
    }
  });

  // API Route: Update Claude Desktop Config
  app.post("/api/config", async (req, res) => {
    try {
      const configPath = path.join(process.cwd(), "claude_desktop_config.json");
      await fs.writeFile(configPath, JSON.stringify(req.body, null, 2), "utf-8");
      res.json({ message: "Configuration updated successfully." });
    } catch (error) {
      console.error("Error writing config:", error);
      res.status(500).json({ error: "Failed to update configuration file." });
    }
  });

  // API Route: Health Check
  app.get("/api/status", (req, res) => {
    res.json({ status: "cyber_link_stable", epoch: Date.now() });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[CYBER_CORE] Server manifesting at http://localhost:${PORT}`);
  });
}

startServer();

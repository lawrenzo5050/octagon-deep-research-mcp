import express from 'express';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';
import OpenAI from 'openai';
import { readFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

// Load package info
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const packageJsonPath = path.join(__dirname, "..", "package.json");
const packageJsonContent = await readFile(packageJsonPath, "utf8");
const packageInfo = JSON.parse(packageJsonContent);

// OpenAI / Octagon API client
const octagonClient = new OpenAI({
  apiKey: process.env.OCTAGON_API_KEY!,
  baseURL: process.env.OCTAGON_API_BASE_URL || "https://api.octagonagents.com/v1",
  defaultHeaders: {
    "User-Agent": `${packageInfo.name}/${packageInfo.version} (Node.js/${process.versions.node})`
  },
});

// Streaming helper (same as in index.ts)
async function processStreamingResponse(stream: any): Promise<string> {
  let fullResponse = "";

  for await (const chunk of stream) {
    if (chunk.choices && chunk.choices[0]?.delta?.content) {
      fullResponse += chunk.choices[0].delta.content;
    }
    if (chunk.type === "response.output_text.delta") {
      fullResponse += chunk.text?.delta || "";
    }
  }

  return fullResponse;
}

// Express app
const app = express();
const PORT = 5050;

app.use(bodyParser.json());

app.post('/mcp', async (req, res) => {
  const { prompt } = req.body;

  if (!prompt) return res.status(400).json({ error: 'Missing prompt' });

  try {
    const response = await octagonClient.chat.completions.create({
      model: "octagon-deep-research-agent",
      messages: [{ role: "user", content: prompt }],
      stream: true,
      metadata: { tool: "mcp" }
    });

    const result = await processStreamingResponse(response);
    res.json({ result });

  } catch (err) {
    console.error("Error in MCP:", err);
    res.status(500).json({ error: "Failed to process request" });
  }
});

app.listen(PORT, () => {
  console.log(`✅ MCP HTTP API running at http://localhost:${PORT}/mcp`);
});

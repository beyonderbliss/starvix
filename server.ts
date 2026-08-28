import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";
import { createServer as createViteServer } from "vite";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "25mb" }));

// Initialize Google GenAI with fallback
function getGeminiClient(customApiKey?: string) {
  const apiKey = customApiKey || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured on server or in request.");
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: Date.now(),
    serverGeminiAvailable: Boolean(process.env.GEMINI_API_KEY),
  });
});

// Gemini Generation endpoint
app.post("/api/gemini/generate", async (req, res) => {
  try {
    const { prompt, systemInstruction, model = "gemini-2.5-flash", apiKey: customKey } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: "Missing prompt parameter" });
    }

    const ai = getGeminiClient(customKey);

    const config: Record<string, unknown> = {
      temperature: 0.2,
    };
    if (systemInstruction) {
      config.systemInstruction = systemInstruction;
    }

    const response = await ai.models.generateContent({
      model: model || "gemini-2.5-flash",
      contents: prompt,
      config,
    });

    const outputText = response.text || "";
    return res.json({ text: outputText });
  } catch (error: unknown) {
    const err = error as Error;
    console.error("Gemini API error:", err.message);
    return res.status(500).json({
      error: err.message || "Failed to generate content from Gemini API",
    });
  }
});

// Gemini Chat & Integrated Editor Copilot endpoint
app.post("/api/gemini/chat", async (req, res) => {
  try {
    const {
      messages = [],
      currentCode = "",
      activeChunkName = "",
      activeChunkCode = "",
      systemInstruction: customSystemInstruction,
      model = "gemini-2.5-flash",
      apiKey: customKey,
    } = req.body;

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: "Messages array cannot be empty" });
    }

    const ai = getGeminiClient(customKey);

    // Build intelligent context-aware system instruction
    const defaultSystemInstruction = [
      "You are STARVIX AI Editor Copilot, an intelligent coding companion integrated directly inside the code editor.",
      "You are designed to understand and execute instructions in everyday conversational language (bahasa sehari-hari, Indonesian, English, casual dev talk).",
      "Users may say things like: 'tolong bikinin tombol dark mode', 'tambahin validasi input', 'ganti warnanya jadi amber', 'bikin animasi pas hover', 'perbaiki error ini dong', 'jelasin bagian ini'.",
      "",
      "When responding:",
      "1. Speak in a friendly, conversational, and direct tone (in the same language the user addressed you with, e.g. Bahasa Indonesia sehari-hari).",
      "2. If the user asks for code changes, feature additions, or bug fixes:",
      "   - Briefly summarize in 1-2 sentences what you did.",
      "   - Provide the complete updated code (or updated component snippet) enclosed in a markdown code block (```javascript or ```jsx).",
      "   - Ensure the code works in our React 19 environment (using React hooks, Tailwind CSS classes, and Lucide icons).",
      "   - Never use fake or missing imports. You can use standard React, lucide-react icons, and Tailwind CSS.",
      "3. If the user asks for explanation or guidance, explain clearly and concisely without unnecessary academic jargon.",
      "",
      currentCode
        ? `--- CURRENT CODE IN EDITOR (${currentCode.split('\n').length} lines) ---\n\`\`\`javascript\n${
            currentCode.length > 30000 ? currentCode.slice(0, 30000) + '\n// ... [truncated for memory safety]' : currentCode
          }\n\`\`\``
        : "",
      activeChunkName && activeChunkCode
        ? `--- ACTIVE TARGET CHUNK (${activeChunkName}) ---\n\`\`\`javascript\n${activeChunkCode}\n\`\`\``
        : "",
    ]
      .filter(Boolean)
      .join("\n\n");

    // Format messages for @google/genai
    const formattedContents = messages.map((m: { role: string; content: string }) => ({
      role: m.role === "assistant" || m.role === "model" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

    const config: Record<string, unknown> = {
      temperature: 0.3,
      systemInstruction: customSystemInstruction || defaultSystemInstruction,
    };

    let response;
    try {
      response = await ai.models.generateContent({
        model: model || "gemini-2.5-flash",
        contents: formattedContents,
        config,
      });
    } catch (primaryErr: unknown) {
      // If requested model fails, attempt fallback to gemini-2.5-flash or gemini-3.7-flash
      const fallbackModel = model === "gemini-3.7-flash" ? "gemini-2.5-flash" : "gemini-3.7-flash";
      console.warn(`Primary model ${model} failed, trying fallback ${fallbackModel}:`, (primaryErr as Error).message);
      response = await ai.models.generateContent({
        model: fallbackModel,
        contents: formattedContents,
        config,
      });
    }

    const outputText = response.text || "";
    return res.json({
      text: outputText,
      modelUsed: model,
    });
  } catch (error: unknown) {
    const err = error as Error;
    console.error("Gemini Copilot Chat API error:", err.message);
    return res.status(500).json({
      error: err.message || "Failed to process chat with Gemini Copilot",
    });
  }
});

// GitHub Gist Proxy endpoint (to bypass any mobile browser CORS issues)
app.post("/api/github/gists", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: "Missing GitHub authorization header" });
    }

    const { description, files, public: isPublic = false } = req.body;
    if (!files || Object.keys(files).length === 0) {
      return res.status(400).json({ error: "Gist payload must include at least one file" });
    }

    const githubResponse = await fetch("https://api.github.com/gists", {
      method: "POST",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: authHeader,
        "User-Agent": "STARVIX-Mobile-Agent-Studio/1.0",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        description: description || "STARVIX Modular Gist Component",
        public: Boolean(isPublic),
        files,
      }),
    });

    const data = await githubResponse.json();
    if (!githubResponse.ok) {
      return res.status(githubResponse.status).json(data);
    }

    return res.json(data);
  } catch (error: unknown) {
    const err = error as Error;
    console.error("GitHub Gist Proxy error:", err.message);
    return res.status(500).json({ error: err.message || "Failed to proxy GitHub Gist request" });
  }
});

async function startServer() {
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
    console.log(`STARVIX Mobile Agent Studio server running at http://0.0.0.0:${PORT}`);
  });
}

startServer();

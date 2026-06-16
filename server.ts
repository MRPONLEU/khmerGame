import express from "express";
import path from "path";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Lazy-initialize Gemini client
let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key || key === "MY_GEMINI_API_KEY") {
      throw new Error("GEMINI_API_KEY is not defined or is a placeholder.");
    }
    aiClient = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

// REST route for generating custom Khmer words
app.post("/api/gemini/generate-words", async (req, res) => {
  try {
    const { category, difficulty } = req.body;
    
    if (!category) {
      return res.status(400).json({ error: "Category is required" });
    }

    const ai = getGeminiClient();

    const difficultyText = difficulty === "easy" ? "ងាយៗខ្លីៗ" : difficulty === "hard" ? "វែងៗនិងពិបាកជាងមុន" : "កម្រិតមធ្យម";

    const prompt = `Please generate exactly 5 Cambodian (Khmer) words about the category "${category}" suitable for children's reading and vocabulary development (${difficultyText}).
Decompose each word into logical spelling blocks readable of standard letters and subscripts. Subscripts (ជើង) should be represented as single unified items (e.g., '្ម', '្រ', '្យ', '្វ', '្អ', '្ល', '្ច' instead of separate '្' and 'ម'). Vowels (ស្រៈ) and diacritics like '់' (បន្តក់) should be separate blocks. Output should be strictly formatted via the provided JSON schema. Ensure the words are appropriate, positive, and correctly spelled in Cambodian.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction: "You are an expert Khmer language teacher and developer of gamified learning resources for primary school kids. You provide beautifully simple, precise vocabularies with friendly clues.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            words: {
              type: Type.ARRAY,
              description: "Array of exactly 5 Khmer spelling challenges.",
              items: {
                type: Type.OBJECT,
                properties: {
                  word: {
                    type: Type.STRING,
                    description: "The full Khmer word (e.g. 'សត្វខ្លា')"
                  },
                  clue: {
                    type: Type.STRING,
                    description: "A friendly definition or clue in Khmer describing the word."
                  },
                  blocks: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                    description: "Array of logical characters composing the word visually/spelling-wise (e.g. ['ខ្ល', 'ា'] or ['ស', 'ត', '្វ', '៍']). Include subscripts as single unified elements."
                  },
                  prefilled: {
                    type: Type.ARRAY,
                    items: { type: Type.BOOLEAN },
                    description: "Boolean array matching length of blocks. Set 40-60% of them to true (as hints), leaving 2-3 fields false for the child to fill in."
                  }
                },
                required: ["word", "clue", "blocks", "prefilled"]
              }
            }
          },
          required: ["words"]
        }
      }
    });

    const text = response.text;
    if (!text) {
      throw new Error("No response content from Gemini.");
    }

    const result = JSON.parse(text);
    return res.json(result);

  } catch (error: any) {
    console.error("Gemini Words Generation Error:", error);
    return res.status(500).json({
      error: error.message || "Failed to generate words via Gemini.",
      useFallback: true
    });
  }
});

// Configure Vite middleware in development or Static routes in production
async function setupVite() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    console.log("Joined Vite development middleware.");
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
    console.log("Serving static production assets.");
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running at http://0.0.0.0:${PORT}`);
  });
}

setupVite().catch((err) => {
  console.error("Vite/Express initialization failed:", err);
});

import { generateTextWithFallback } from "./src/services/aiProvider";
import { GoogleGenAI } from "@google/genai";

async function run() {
  const aiClient = new GoogleGenAI({ apiKey: "dummy" });
  
  // mock generateContent to simulate failure
  aiClient.models.generateContent = async () => {
    throw new Error("Simulated Gemini Failure");
  };

  try {
    const result = await generateTextWithFallback({
      contents: [{ role: "user", parts: [{ text: "oi" }] }],
      category: "search"
    }, aiClient);
    console.log("SUCCESS:", result.provider, result.modelUsed);
  } catch (err) {
    console.error("ERROR:", err);
  }
}

run();

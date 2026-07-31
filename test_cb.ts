import { generateTextWithFallback } from "./src/services/aiProvider";
import { GoogleGenAI } from "@google/genai";

async function run() {
  const aiClient = new GoogleGenAI({ apiKey: "dummy" });
  
  // Try 4 times, let's see if the 4th time ignores Gemini directly
  for (let i = 1; i <= 4; i++) {
     console.log(`\n--- TENTATIVA ${i} ---`);
     try {
       await generateTextWithFallback({
         contents: [{ role: "user", parts: [{ text: "oi" }] }],
         category: "general"
       }, aiClient);
     } catch (err) {}
  }
}

run();

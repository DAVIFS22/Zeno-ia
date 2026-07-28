import { GoogleGenAI } from "@google/genai";
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
async function run() {
  const res = await ai.models.list();
  for await (const m of res) {
    if (m.name.includes("gemini")) {
      console.log(m.name);
    }
  }
}
run();

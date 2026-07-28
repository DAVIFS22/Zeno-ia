import { GoogleGenAI } from "@google/genai";
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
ai.models.generateContent({ model: "gemini-3.5-flash", contents: "hi" }).then(res => console.log("3.5-flash:", res.text)).catch(e => console.error(e.message || e));

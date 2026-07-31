import { GoogleGenAI } from "@google/genai";
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
ai.models.generateContent({ model: "gemini-1.5-flash", contents: "hi" }).then(res => console.log("1.5-flash:", res.text)).catch(e => console.error(e));
ai.models.generateContent({ model: "gemini-3.6-flash", contents: "hi" }).then(res => console.log("2.0-flash:", res.text)).catch(e => console.error(e));

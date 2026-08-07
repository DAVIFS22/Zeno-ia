import { GoogleGenAI } from "@google/genai";
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
async function testModel(name: string) {
  try {
    const res = await ai.models.generateContent({ model: name, contents: "hi" });
    console.log(name, "SUCCESS", res.text?.substring(0, 20));
  } catch (e: any) {
    console.error(name, "ERROR", e.status, e.message.substring(0, 100));
  }
}
async function run() {
  await testModel("gemini-3.5-flash-lite");
  await testModel("gemini-1.5-flash");
  await testModel("gemini-flash-lite-latest");
  await testModel("gemini-flash-latest");
}
run();

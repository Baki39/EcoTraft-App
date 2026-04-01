import "dotenv/config";
import { GoogleGenAI, Type } from "@google/genai";

async function test() {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: {
        parts: [
          {
            inlineData: {
              data: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
              mimeType: "image/png",
            }
          },
          {
            text: "Test"
          }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            itemName: { type: Type.STRING },
            ideas: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  title: { type: Type.STRING },
                  shortDescription: { type: Type.STRING },
                  instructions: { type: Type.ARRAY, items: { type: Type.STRING } },
                  materials: { type: Type.ARRAY, items: { type: Type.STRING } },
                  imagePrompt: { type: Type.STRING },
                },
                required: ["id", "title", "shortDescription", "instructions", "materials", "imagePrompt"]
              }
            },
            disposal: {
              type: Type.OBJECT,
              properties: {
                instructions: { type: Type.STRING },
                ecoFact: { type: Type.STRING }
              },
              required: ["instructions", "ecoFact"]
            }
          },
          required: ["itemName", "ideas", "disposal"]
        }
      }
    });
    console.log(response.text);
  } catch (e) {
    console.error(e);
  }
}
test();

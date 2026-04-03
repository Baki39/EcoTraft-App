import { GoogleGenAI } from "@google/genai";

export interface ProjectIdea {
  id: string;
  title: string;
  shortDescription: string;
  instructions: string[];
  materials: string[];
  imagePrompt: string;
}

export interface AnalysisResult {
  itemName: string;
  ideas: ProjectIdea[];
  disposal: {
    instructions: string;
    ecoFact: string;
  };
}

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function analyzeItem(base64Image: string, mimeType: string, language: string): Promise<AnalysisResult> {
  const prompt = `Analyze this image of an item. The user wants to upcycle it.
  CRITICAL INSTRUCTION: You MUST provide ALL text responses (itemName, title, shortDescription, instructions, materials, disposal instructions, and ecoFact) in the following language: ${language}. 
  Only the 'id' and 'imagePrompt' fields should remain in English.

  Return a JSON object with:
  1. itemName: The name of the item (in ${language}).
  2. ideas: An array of exactly 3 distinct, creative DIY project ideas to upcycle this item. For each idea, provide:
     - id: a unique string (e.g., "idea-1")
     - title: A catchy title for the project (in ${language}).
     - shortDescription: A 1-sentence description (in ${language}).
     - instructions: An array of step-by-step instructions (in ${language}).
     - materials: An array of additional materials needed (in ${language}).
     - imagePrompt: A detailed prompt IN ENGLISH to transform the provided image into the FINAL completed project. CRITICAL: The prompt MUST explicitly instruct the image generator to use the original image as the base, retaining the EXACT shape, color, texture, and identity of the original item, and ONLY add the necessary modifications to upcycle it. Do NOT generate a completely new or similar item. It should be photorealistic, high quality, studio lighting.
  3. disposal: Instructions on how to properly recycle or dispose of this item if the user chooses not to upcycle it.
     - instructions: Step-by-step eco-friendly disposal instructions (in ${language}).
     - ecoFact: A positive, encouraging eco-fact related to recycling this item (in ${language}).`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: {
        parts: [
          {
            inlineData: {
              data: base64Image,
              mimeType: mimeType,
            }
          },
          {
            text: prompt
          }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT" as any,
          properties: {
            itemName: { type: "STRING" as any },
            ideas: {
              type: "ARRAY" as any,
              items: {
                type: "OBJECT" as any,
                properties: {
                  id: { type: "STRING" as any },
                  title: { type: "STRING" as any },
                  shortDescription: { type: "STRING" as any },
                  instructions: { type: "ARRAY" as any, items: { type: "STRING" as any } },
                  materials: { type: "ARRAY" as any, items: { type: "STRING" as any } },
                  imagePrompt: { type: "STRING" as any },
                },
                required: ["id", "title", "shortDescription", "instructions", "materials", "imagePrompt"]
              }
            },
            disposal: {
              type: "OBJECT" as any,
              properties: {
                instructions: { type: "STRING" as any },
                ecoFact: { type: "STRING" as any }
              },
              required: ["instructions", "ecoFact"]
            }
          },
          required: ["itemName", "ideas", "disposal"]
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response from AI");
    
    return JSON.parse(text) as AnalysisResult;
  } catch (error: any) {
    console.error("Error analyzing image:", error);
    if (error.status === 503 || error.message?.includes('503') || error.message?.includes('high demand') || error.message?.includes('UNAVAILABLE')) {
      throw new Error("The AI model is currently experiencing high demand. Please wait a moment and try again.");
    }
    throw new Error(`Failed to analyze item: ${error.message}`);
  }
}

export async function generateProjectImage(prompt: string, originalImageBase64?: string): Promise<string> {
  let contents: any = prompt;

  if (originalImageBase64) {
    const matches = originalImageBase64.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (matches && matches.length === 3) {
      const mimeType = matches[1];
      const base64Data = matches[2];
      
      contents = {
        parts: [
          {
            inlineData: {
              data: base64Data,
              mimeType: mimeType,
            }
          },
          {
            text: prompt
          }
        ]
      };
    } else {
      const parts = originalImageBase64.split(',');
      if (parts.length === 2 && parts[0].startsWith('data:')) {
        const mimeType = parts[0].split(':')[1].split(';')[0];
        const base64Data = parts[1];
        contents = {
          parts: [
            {
              inlineData: {
                data: base64Data,
                mimeType: mimeType,
              }
            },
            {
              text: prompt
            }
          ]
        };
      }
    }
  }

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: contents,
      config: {
        imageConfig: {
          aspectRatio: "1:1"
        }
      }
    });

    let imageUrl = null;
    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        imageUrl = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
        break;
      }
    }

    if (!imageUrl) {
      throw new Error("No image generated");
    }

    return imageUrl;
  } catch (error: any) {
    console.error("Error generating image:", error);
    if (error.status === 503 || error.message?.includes('503') || error.message?.includes('high demand') || error.message?.includes('UNAVAILABLE')) {
      throw new Error("The AI model is currently experiencing high demand. Please try generating the image again later.");
    }
    throw new Error('Failed to generate image');
  }
}

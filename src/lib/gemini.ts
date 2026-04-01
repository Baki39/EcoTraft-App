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

// In a real APK, this URL should point to your deployed backend (e.g., Cloud Run URL)
// For local development or when hosted on the same domain, we can use relative paths.
const API_BASE_URL = import.meta.env.VITE_API_URL || '';

export async function analyzeItem(base64Image: string, mimeType: string, language: string): Promise<AnalysisResult> {
  const response = await fetch(`${API_BASE_URL}/api/analyze`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ base64Image, mimeType, language }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Server error response:", errorText);
    
    if (response.status === 503 || errorText.includes('503') || errorText.includes('high demand') || errorText.includes('UNAVAILABLE')) {
      throw new Error("The AI model is currently experiencing high demand. Please wait a moment and try again.");
    }
    
    throw new Error(`Failed to analyze item: ${response.status} ${response.statusText}`);
  }

  return await response.json() as AnalysisResult;
}

export async function generateProjectImage(prompt: string, originalImageBase64?: string): Promise<string> {
  const response = await fetch(`${API_BASE_URL}/api/generate-image`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ prompt, originalImageBase64 }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    if (response.status === 503 || errorText.includes('503') || errorText.includes('high demand') || errorText.includes('UNAVAILABLE')) {
      throw new Error("The AI model is currently experiencing high demand. Please try generating the image again later.");
    }
    throw new Error('Failed to generate image');
  }

  const data = await response.json();
  return data.imageUrl;
}

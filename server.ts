import dotenv from "dotenv";
dotenv.config({ override: true });
import express from "express";
import { createServer as createViteServer } from "vite";
import cors from "cors";
import path from "path";
import { GoogleGenAI } from "@google/genai";
import Stripe from "stripe";
import admin from "firebase-admin";
import fs from "fs";

// Initialize Firebase Admin
const firebaseConfigPath = path.join(process.cwd(), "firebase-applet-config.json");
if (fs.existsSync(firebaseConfigPath)) {
  const firebaseConfig = JSON.parse(fs.readFileSync(firebaseConfigPath, "utf-8"));
  if (!admin.apps.length) {
    const adminConfig: admin.AppOptions = {
      projectId: firebaseConfig.projectId,
    };
    
    // Use service account key if provided (for external hosting like Render/Vercel)
    if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
      try {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
        adminConfig.credential = admin.credential.cert(serviceAccount);
      } catch (e) {
        console.error("Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY", e);
      }
    }

    admin.initializeApp(adminConfig);
    admin.firestore().settings({ databaseId: firebaseConfig.firestoreDatabaseId });
  }
}

let stripeClient: Stripe | null = null;
function getStripe(): Stripe {
  if (!stripeClient) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
      throw new Error("STRIPE_SECRET_KEY environment variable is required");
    }
    stripeClient = new Stripe(key, { apiVersion: "2023-10-16" as any });
  }
  return stripeClient;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Allow requests from mobile apps (Capacitor/Cordova)
  app.use(cors());
  
  // Stripe Webhook needs raw body
  app.post('/api/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    const sig = req.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!sig || !webhookSecret) {
      return res.status(400).send('Webhook secret or signature missing');
    }

    try {
      const stripe = getStripe();
      const event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);

      if (event.type === 'checkout.session.completed') {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.client_reference_id;
        
        if (userId && admin.apps.length) {
          await admin.firestore().collection('users').doc(userId).update({
            subscriptionStatus: 'active',
            stripeCustomerId: session.customer,
            subscriptionId: session.subscription,
          });
        }
      }

      res.json({ received: true });
    } catch (err: any) {
      console.error('Webhook Error:', err.message);
      res.status(400).send(`Webhook Error: ${err.message}`);
    }
  });

  // Increase payload limit for base64 images
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  async function executeWithRetry<T>(operation: () => Promise<T>, maxRetries = 3): Promise<T> {
    let attempt = 0;
    while (attempt < maxRetries) {
      try {
        return await operation();
      } catch (error: any) {
        attempt++;
        const isRetryable = error.status === 503 || error.message?.includes('503') || error.message?.includes('high demand') || error.message?.includes('UNAVAILABLE');
        if (!isRetryable || attempt >= maxRetries) {
          throw error;
        }
        // Silently retry on 503 to avoid cluttering logs with expected high-demand errors
        await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt))); // 2s, 4s, 8s
      }
    }
    throw new Error("Max retries reached");
  }

  // API routes FIRST
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.post("/api/create-checkout-session", async (req, res) => {
    try {
      const { plan, userId } = req.body;
      const stripe = getStripe();
      
      // Use the origin of the request to ensure it redirects back to the correct AI Studio URL
      let appUrl = process.env.APP_URL;
      if (!appUrl) {
        const origin = req.headers.origin || req.headers.referer;
        if (origin) {
          // Remove trailing slash if present
          appUrl = origin.endsWith('/') ? origin.slice(0, -1) : origin;
        } else {
          appUrl = 'http://localhost:3000';
        }
      }

      let priceId = '';
      if (plan === 'monthly') {
        priceId = process.env.STRIPE_PRICE_MONTHLY || '';
      } else if (plan === 'quarterly') {
        priceId = process.env.STRIPE_PRICE_QUARTERLY || '';
      }

      if (!priceId) {
        return res.status(400).json({ error: "Price ID not configured for this plan." });
      }

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        mode: 'subscription',
        success_url: `${appUrl}?success=true`,
        cancel_url: `${appUrl}?canceled=true`,
        client_reference_id: userId,
        subscription_data: plan === 'monthly' ? { trial_period_days: 3 } : undefined,
      });

      res.json({ url: session.url });
    } catch (error: any) {
      console.error("Error creating checkout session:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/analyze", async (req, res) => {
    try {
      const { base64Image, mimeType, language } = req.body;

      if (!base64Image || !mimeType || !language) {
        return res.status(400).json({ error: "Missing required fields" });
      }

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

      const response = await executeWithRetry(() => ai.models.generateContent({
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
            type: "OBJECT",
            properties: {
              itemName: { type: "STRING" },
              ideas: {
                type: "ARRAY",
                items: {
                  type: "OBJECT",
                  properties: {
                    id: { type: "STRING" },
                    title: { type: "STRING" },
                    shortDescription: { type: "STRING" },
                    instructions: { type: "ARRAY", items: { type: "STRING" } },
                    materials: { type: "ARRAY", items: { type: "STRING" } },
                    imagePrompt: { type: "STRING" },
                  },
                  required: ["id", "title", "shortDescription", "instructions", "materials", "imagePrompt"]
                }
              },
              disposal: {
                type: "OBJECT",
                properties: {
                  instructions: { type: "STRING" },
                  ecoFact: { type: "STRING" }
                },
                required: ["instructions", "ecoFact"]
              }
            },
            required: ["itemName", "ideas", "disposal"]
          }
        }
      }));

      const text = response.text;
      if (!text) throw new Error("No response from AI");
      
      res.json(JSON.parse(text));
    } catch (error: any) {
      console.error("Error analyzing image:", error);
      res.status(500).json({ error: "Failed to analyze image", details: error.message, stack: error.stack });
    }
  });

  app.post("/api/generate-image", async (req, res) => {
    try {
      const { prompt, originalImageBase64 } = req.body;

      if (!prompt) {
        return res.status(400).json({ error: "Missing prompt" });
      }

      let contents: any = prompt;

      if (originalImageBase64) {
        // Extract mime type and base64 data from data URI
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
        }
      }

      const response = await executeWithRetry(() => ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: contents,
        config: {
          imageConfig: {
            aspectRatio: "1:1"
          }
        }
      }));

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

      res.json({ imageUrl });
    } catch (error) {
      console.error("Error generating image:", error);
      res.status(500).json({ error: "Failed to generate image" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

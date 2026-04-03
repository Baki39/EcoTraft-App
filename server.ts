import dotenv from "dotenv";
dotenv.config({ override: true });
import express from "express";
import { createServer as createViteServer } from "vite";
import cors from "cors";
import path from "path";
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

  const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
  console.log("API Key exists:", !!apiKey);

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

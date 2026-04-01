# AI Upcycling App

This is a full-stack React application built with Vite, Express, Firebase, Stripe, and Google Gemini AI.

## Features
- **AI Upcycling Ideas**: Upload an image of an item and get 3 creative DIY upcycling projects.
- **Photorealistic Previews**: See AI-generated images of the final upcycled product.
- **Stripe Subscriptions**: Monthly and Quarterly subscription plans.
- **Firebase Authentication**: Secure Google Sign-in.
- **Firestore Database**: Store user profiles, subscriptions, and saved projects.

## Prerequisites
- Node.js (v18 or higher)
- A Firebase project (with Authentication and Firestore enabled)
- A Stripe account
- A Google Gemini API key

## Local Development Setup

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd <your-repo-name>
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure Environment Variables**
   Copy `.env.example` to `.env` and fill in the required values:
   ```bash
   cp .env.example .env
   ```
   - `GEMINI_API_KEY`: Get this from Google AI Studio.
   - `STRIPE_SECRET_KEY`: Get this from your Stripe Dashboard.
   - `STRIPE_WEBHOOK_SECRET`: Get this by setting up a webhook endpoint in Stripe (pointing to `http://localhost:3000/api/webhook`).
   - `STRIPE_PRICE_MONTHLY` & `STRIPE_PRICE_QUARTERLY`: The Price IDs from your Stripe Products.
   - `FIREBASE_SERVICE_ACCOUNT_KEY`: (Optional for local if using Firebase Emulator, but required for production) Generate a new private key from Firebase Console -> Project Settings -> Service Accounts, and paste the entire JSON string here.

4. **Firebase Configuration**
   Ensure `firebase-applet-config.json` is present in the root directory. This file contains your Firebase project configuration and is used by both the frontend (Firebase SDK) and backend (Firebase Admin SDK). If you're deploying from GitHub, make sure you either commit this file or generate it dynamically during your build step using environment variables.

   Example `firebase-applet-config.json`:
   ```json
   {
     "projectId": "your-project-id",
     "appId": "1:1234567890:web:abcdef123456",
     "apiKey": "AIzaSyYourApiKeyHere...",
     "authDomain": "your-project-id.firebaseapp.com",
     "firestoreDatabaseId": "(default)",
     "storageBucket": "your-project-id.firebasestorage.app",
     "messagingSenderId": "1234567890",
     "measurementId": ""
   }
   ```

5. **Start the Development Server**
   ```bash
   npm run dev
   ```
   The app will be available at `http://localhost:3000`.

## Deployment

This app uses a custom Express server to handle API routes (Stripe webhooks, Gemini AI calls) and serves the Vite React frontend.

### Deploying to Render / Heroku / Railway
1. Push your code to GitHub.
2. Connect your repository to your hosting provider.
3. Set the **Build Command** to: `npm run build`
4. Set the **Start Command** to: `npm run start`
5. Add all the environment variables from your `.env` file to the hosting provider's environment variables settings. **Make sure to include `FIREBASE_SERVICE_ACCOUNT_KEY`** so the backend can securely access Firestore.

### Deploying to Vercel
If you want to deploy to Vercel, you will need to convert the Express routes in `server.ts` into Vercel Serverless Functions (`api/` directory) and update the frontend fetch calls accordingly.

## License
MIT

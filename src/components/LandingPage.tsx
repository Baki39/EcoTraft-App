import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Sparkles, Recycle, Image as ImageIcon, CheckCircle2, Play, Loader2 } from 'lucide-react';

interface LandingPageProps {
  user: any;
  onSubscribe: (plan: 'monthly' | 'quarterly') => void;
  isSubscribing: boolean;
  onStartApp: () => void;
  loginError?: string | null;
  isLoggingIn?: boolean;
}

export function LandingPage({ user, onSubscribe, isSubscribing, onStartApp, loginError, isLoggingIn }: LandingPageProps) {
  return (
    <div className="min-h-screen bg-dark text-white selection:bg-selenium/30">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-eco/10 to-transparent pointer-events-none" />
        
        <div className="max-w-5xl mx-auto px-6 pt-24 pb-16 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-selenium/10 text-selenium text-sm font-medium mb-8"
          >
            <Sparkles className="w-4 h-4" />
            <span>AI-Powered Upcycling</span>
          </motion.div>

          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-5xl sm:text-7xl font-bold tracking-tight mb-6"
          >
            Transform Trash into <br className="hidden sm:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-selenium to-eco">
              Treasure
            </span>
          </motion.h1>

          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-xl text-zinc-400 max-w-2xl mx-auto mb-10"
          >
            Scan any old item and let our AI generate beautiful, step-by-step DIY projects to give it a second life.
          </motion.p>

          {!user && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <button
                onClick={onStartApp}
                disabled={isLoggingIn}
                className="inline-flex items-center gap-2 px-8 py-4 rounded-full bg-white text-black hover:bg-zinc-200 transition-colors text-lg font-semibold disabled:opacity-50"
              >
                {isLoggingIn ? <Loader2 className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5" />}
                {isLoggingIn ? 'Pokretanje...' : 'Start App'}
              </button>
              {loginError && (
                <div className="mt-4 p-4 bg-red-500/20 border border-red-500/50 rounded-xl text-red-200 text-sm max-w-md mx-auto">
                  {loginError}
                </div>
              )}
              <p className="mt-4 text-sm text-zinc-500">No registration required</p>
            </motion.div>
          )}
        </div>
      </div>

      {/* Features */}
      <div className="max-w-5xl mx-auto px-6 py-20">
        <div className="grid sm:grid-cols-3 gap-8">
          {[
            { icon: Recycle, title: "Scan Items", desc: "Take a photo of any item you want to upcycle." },
            { icon: Sparkles, title: "Get AI Ideas", desc: "Receive 3 unique, creative DIY project ideas instantly." },
            { icon: ImageIcon, title: "Visualize", desc: "See photorealistic AI generated images of the final result." }
          ].map((feature, i) => (
            <motion.div 
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="p-6 rounded-3xl bg-zinc-900/50 border border-zinc-800"
            >
              <div className="w-12 h-12 rounded-2xl bg-eco/10 flex items-center justify-center text-eco mb-4">
                <feature.icon className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
              <p className="text-zinc-400">{feature.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}

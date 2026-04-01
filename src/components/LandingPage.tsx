import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Sparkles, Recycle, Image as ImageIcon, CheckCircle2, LogIn, Loader2 } from 'lucide-react';
import { signInWithGoogle } from '../firebase';

interface LandingPageProps {
  user: any;
  onSubscribe: (plan: 'monthly' | 'quarterly') => void;
  isSubscribing: boolean;
}

export function LandingPage({ user, onSubscribe, isSubscribing }: LandingPageProps) {
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
                onClick={signInWithGoogle}
                className="inline-flex items-center gap-2 px-8 py-4 rounded-full bg-white text-black hover:bg-zinc-200 transition-colors text-lg font-semibold"
              >
                <LogIn className="w-5 h-5" />
                Continue with Google
              </button>
              <p className="mt-4 text-sm text-zinc-500">Sign in to start your free trial</p>
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

      {/* Pricing */}
      <div className="max-w-5xl mx-auto px-6 py-20" id="pricing">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">Choose Your Plan</h2>
          <p className="text-zinc-400">Start your creative journey today.</p>
        </div>

        <div className="grid sm:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {/* Monthly Plan */}
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="p-8 rounded-3xl bg-zinc-900 border border-zinc-800 relative flex flex-col"
          >
            <div className="mb-8">
              <h3 className="text-2xl font-semibold mb-2">Monthly</h3>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-bold">$9.99</span>
                <span className="text-zinc-400">/month</span>
              </div>
              <p className="text-selenium text-sm mt-2 font-medium">Includes 3-day free trial</p>
            </div>

            <ul className="space-y-4 mb-8 flex-1">
              {['Unlimited AI scans', 'Photorealistic image generation', 'Save unlimited projects', 'Cancel anytime'].map((feature, i) => (
                <li key={i} className="flex items-center gap-3 text-zinc-300">
                  <CheckCircle2 className="w-5 h-5 text-eco shrink-0" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>

            <button
              onClick={() => user ? onSubscribe('monthly') : signInWithGoogle()}
              disabled={isSubscribing}
              className="w-full py-4 rounded-xl bg-white text-black hover:bg-zinc-200 transition-colors font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isSubscribing ? <Loader2 className="w-5 h-5 animate-spin" /> : (user ? 'Start Free Trial' : 'Sign in to Subscribe')}
            </button>
          </motion.div>

          {/* Quarterly Plan */}
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="p-8 rounded-3xl bg-gradient-to-b from-eco/10 to-zinc-900 border border-eco/30 relative flex flex-col"
          >
            <div className="absolute top-0 right-8 -translate-y-1/2 px-3 py-1 bg-selenium text-black text-xs font-bold uppercase tracking-wider rounded-full">
              Save 15%
            </div>

            <div className="mb-8">
              <h3 className="text-2xl font-semibold mb-2">3 Months</h3>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-bold">$24.99</span>
                <span className="text-zinc-400">/quarter</span>
              </div>
              <p className="text-zinc-400 text-sm mt-2">Billed every 3 months</p>
            </div>

            <ul className="space-y-4 mb-8 flex-1">
              {['Everything in Monthly', 'Priority AI processing', 'Early access to new features', 'Support eco-friendly initiatives'].map((feature, i) => (
                <li key={i} className="flex items-center gap-3 text-zinc-300">
                  <CheckCircle2 className="w-5 h-5 text-eco shrink-0" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>

            <button
              onClick={() => user ? onSubscribe('quarterly') : signInWithGoogle()}
              disabled={isSubscribing}
              className="w-full py-4 rounded-xl bg-selenium text-black hover:bg-[#C6E500] transition-colors font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isSubscribing ? <Loader2 className="w-5 h-5 animate-spin" /> : (user ? 'Subscribe Now' : 'Sign in to Subscribe')}
            </button>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

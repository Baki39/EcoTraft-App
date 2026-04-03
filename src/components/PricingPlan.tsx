import React from 'react';
import { motion } from 'motion/react';
import { CheckCircle2, Loader2 } from 'lucide-react';

interface PricingPlanProps {
  onSubscribe: (plan: 'monthly' | 'quarterly') => void;
  isSubscribing: boolean;
}

export function PricingPlan({ onSubscribe, isSubscribing }: PricingPlanProps) {
  return (
    <div className="w-full max-w-5xl mx-auto px-4 py-12" id="pricing">
      <div className="text-center mb-12">
        <h2 className="text-3xl sm:text-4xl font-bold mb-4">You've reached your free limit</h2>
        <p className="text-zinc-400">Choose a plan to continue generating AI upcycling ideas.</p>
      </div>

      <div className="grid sm:grid-cols-2 gap-8 max-w-4xl mx-auto">
        {/* Monthly Plan */}
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
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
            onClick={() => onSubscribe('monthly')}
            disabled={isSubscribing}
            className="w-full py-4 rounded-xl bg-white text-black hover:bg-zinc-200 transition-colors font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isSubscribing ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Start Free Trial'}
          </button>
        </motion.div>

        {/* Quarterly Plan */}
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
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
            onClick={() => onSubscribe('quarterly')}
            disabled={isSubscribing}
            className="w-full py-4 rounded-xl bg-selenium text-black hover:bg-[#C6E500] transition-colors font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isSubscribing ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Subscribe Now'}
          </button>
        </motion.div>
      </div>
    </div>
  );
}

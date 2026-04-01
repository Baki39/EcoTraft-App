import React from 'react';

export function Logo({ className = "w-8 h-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      {/* Pure Black Background with rounded corners */}
      <rect width="100" height="100" rx="24" fill="#050505"/>
      
      {/* Stylized Eco Leaf */}
      <path 
        d="M50 20C50 20 20 35 20 65C20 80 35 85 50 85C65 85 80 80 80 65C80 35 50 20 50 20Z" 
        fill="url(#paint0_linear)"
      />
      
      {/* Inner line detail */}
      <path 
        d="M50 85C50 85 45 65 50 50C55 35 50 20 50 20" 
        stroke="#050505" 
        strokeWidth="4" 
        strokeLinecap="round"
      />
      
      {/* Selenium Accent Dot */}
      <circle cx="65" cy="45" r="6" fill="#E2FF3D"/>
      
      <defs>
        <linearGradient id="paint0_linear" x1="20" y1="20" x2="80" y2="85" gradientUnits="userSpaceOnUse">
          <stop stopColor="#E2FF3D" /> {/* Selenium Color (Neon Yellow-Green) */}
          <stop offset="1" stopColor="#00E676" /> {/* Eco Green */}
        </linearGradient>
      </defs>
    </svg>
  );
}

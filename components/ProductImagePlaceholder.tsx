import React from 'react'

export default function ProductImagePlaceholder({ size = '100%', borderRadius = 12 }: { size?: string | number, borderRadius?: number }) {
  return (
    <div style={{ width: size, height: size, borderRadius, background: 'linear-gradient(135deg,#1E1A10,#2A2310)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="rgba(232,160,32,0.3)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="3"/>
        <circle cx="8.5" cy="8.5" r="1.5"/>
        <path d="M21 15l-5-5L5 21"/>
      </svg>
    </div>
  )
}

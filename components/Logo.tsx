export default function Logo({ size = 38 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 72 72" fill="none">
      <defs>
        <linearGradient id="lg1" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FFD060"/>
          <stop offset="55%" stopColor="#E8901A"/>
          <stop offset="100%" stopColor="#FF4500"/>
        </linearGradient>
        <radialGradient id="lg2" cx="50%" cy="48%">
          <stop offset="0%" stopColor="rgba(255,160,30,0.2)"/>
          <stop offset="100%" stopColor="transparent"/>
        </radialGradient>
      </defs>
      <rect width="72" height="72" rx="17" fill="#0F0B04" stroke="rgba(232,160,32,0.35)" strokeWidth="2"/>
      <circle cx="36" cy="36" r="30" fill="url(#lg2)"/>
      <line x1="36" y1="8" x2="36" y2="5" stroke="#FFD060" strokeWidth="2.5" strokeLinecap="round"/>
      <line x1="48" y1="11" x2="51" y2="8" stroke="#FFD060" strokeWidth="2.5" strokeLinecap="round"/>
      <line x1="58" y1="21" x2="61" y2="19" stroke="#E8901A" strokeWidth="2.2" strokeLinecap="round"/>
      <line x1="62" y1="33" x2="65" y2="33" stroke="#E8901A" strokeWidth="2.2" strokeLinecap="round"/>
      <line x1="58" y1="45" x2="61" y2="47" stroke="#FF6020" strokeWidth="2" strokeLinecap="round"/>
      <line x1="24" y1="11" x2="21" y2="8" stroke="#FFD060" strokeWidth="2.5" strokeLinecap="round"/>
      <line x1="14" y1="21" x2="11" y2="19" stroke="#E8901A" strokeWidth="2.2" strokeLinecap="round"/>
      <line x1="10" y1="33" x2="7" y2="33" stroke="#E8901A" strokeWidth="2.2" strokeLinecap="round"/>
      <line x1="14" y1="45" x2="11" y2="47" stroke="#FF6020" strokeWidth="2" strokeLinecap="round"/>
      <path d="M12 37 Q36 19 60 37 L60 42 Q36 42 12 42 Z" fill="url(#lg1)"/>
      <ellipse cx="24" cy="29" rx="1.8" ry="1" fill="rgba(255,255,255,0.4)" transform="rotate(-20 24 29)"/>
      <ellipse cx="36" cy="25.5" rx="1.8" ry="1" fill="rgba(255,255,255,0.4)"/>
      <ellipse cx="48" cy="29" rx="1.8" ry="1" fill="rgba(255,255,255,0.4)" transform="rotate(20 48 29)"/>
      <rect x="12" y="42" width="48" height="3.5" fill="rgba(165,70,12,0.9)"/>
      <rect x="12" y="45.5" width="48" height="3" fill="rgba(210,45,30,0.82)"/>
      <path d="M12 48.5 Q19 45.5 26 48.5 Q33 51.5 40 48.5 Q47 45.5 60 48.5 L60 52 Q46 56 36 52 Q18 56 12 52 Z" fill="rgba(55,150,45,0.8)"/>
      <path d="M12 52 Q36 56 60 52 L60 59 Q36 63 12 59 Z" fill="url(#lg1)" opacity="0.83"/>
    </svg>
  )
}

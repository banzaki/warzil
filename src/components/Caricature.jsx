// Original, hand-drawn cartoon portraits (inline SVG, no photos or third-party art).
// mood: 'neutral' | 'happy' | 'sad'

function Mouth({ mood, y, color = '#5b2a1e' }) {
  if (mood === 'sad') return <path d={`M50 ${y + 4} Q60 ${y - 4} 70 ${y + 4}`} stroke={color} strokeWidth="3" fill="none" strokeLinecap="round" />;
  if (mood === 'happy')
    return <path d={`M47 ${y - 2} Q60 ${y + 12} 73 ${y - 2} Z`} fill={color} stroke={color} strokeWidth="2" strokeLinejoin="round" />;
  return <path d={`M50 ${y} Q60 ${y + 6} 70 ${y}`} stroke={color} strokeWidth="3" fill="none" strokeLinecap="round" />;
}

function Brows({ mood, y, color, thick = 4 }) {
  const tilt = mood === 'sad' ? -4 : mood === 'happy' ? 2 : 0;
  return (
    <g stroke={color} strokeWidth={thick} strokeLinecap="round">
      <line x1="40" y1={y + tilt} x2="52" y2={y - tilt} />
      <line x1="68" y1={y - tilt} x2="80" y2={y + tilt} />
    </g>
  );
}

function Eyes({ y, mood }) {
  if (mood === 'happy')
    return (
      <g stroke="#222" strokeWidth="3" fill="none" strokeLinecap="round">
        <path d={`M41 ${y + 1} Q46 ${y - 4} 51 ${y + 1}`} />
        <path d={`M69 ${y + 1} Q74 ${y - 4} 79 ${y + 1}`} />
      </g>
    );
  return (
    <g>
      <ellipse cx="46" cy={y} rx="5" ry="5.5" fill="#fff" />
      <ellipse cx="74" cy={y} rx="5" ry="5.5" fill="#fff" />
      <circle cx="47" cy={y + 1} r="2.6" fill="#222" />
      <circle cx="73" cy={y + 1} r="2.6" fill="#222" />
    </g>
  );
}

function Lula({ mood }) {
  return (
    <g>
      {/* red shirt */}
      <path d="M14 120 Q20 92 60 90 Q100 92 106 120 Z" fill="#c62828" />
      <path d="M48 92 L60 106 L72 92" fill="#fff3e0" />
      {/* head */}
      <ellipse cx="60" cy="56" rx="34" ry="36" fill="#e2a77f" />
      <ellipse cx="25" cy="60" rx="6" ry="9" fill="#d89670" />
      <ellipse cx="95" cy="60" rx="6" ry="9" fill="#d89670" />
      {/* grey hair on the sides, generous forehead */}
      <path d="M26 52 Q24 26 44 20 Q38 30 34 50 Z" fill="#d9d9d9" />
      <path d="M94 52 Q96 26 76 20 Q82 30 86 50 Z" fill="#d9d9d9" />
      <path d="M44 20 Q60 14 76 20 Q60 18 44 20 Z" fill="#cfcfcf" />
      {/* big friendly beard */}
      <path d="M26 58 Q26 102 60 104 Q94 102 94 58 Q88 74 76 74 Q60 70 44 74 Q32 74 26 58 Z" fill="#e8e8e8" stroke="#bdbdbd" strokeWidth="1.5" />
      <Brows mood={mood} y={40} color="#616161" thick={5} />
      <Eyes y={49} mood={mood} />
      {/* nose */}
      <path d="M60 50 Q53 66 58 70 Q64 71 66 66" fill="#d08b62" />
      {/* moustache + mouth inside the beard */}
      <path d="M42 77 Q60 68 78 77 Q60 74 42 77 Z" fill="#cfcfcf" />
      <Mouth mood={mood} y={84} color="#7a3326" />
    </g>
  );
}

function Flavio({ mood }) {
  return (
    <g>
      {/* navy suit, white shirt, blue tie */}
      <path d="M12 120 Q18 92 60 90 Q102 92 108 120 Z" fill="#1a237e" />
      <path d="M46 91 L60 112 L74 91 Z" fill="#fff" />
      <path d="M57 96 L63 96 L65 114 L60 120 L55 114 Z" fill="#1e88e5" />
      {/* head: longer oval, clean-shaven */}
      <ellipse cx="60" cy="56" rx="30" ry="37" fill="#f0c4a0" />
      <ellipse cx="29" cy="60" rx="5" ry="8" fill="#e4b08a" />
      <ellipse cx="91" cy="60" rx="5" ry="8" fill="#e4b08a" />
      {/* neat dark hair with a side part */}
      <path d="M29 50 Q26 18 60 16 Q94 18 91 50 Q86 32 70 30 Q56 34 40 30 Q33 38 29 50 Z" fill="#3e2723" />
      <path d="M48 22 Q62 20 82 30" stroke="#5d4037" strokeWidth="2" fill="none" />
      <Brows mood={mood} y={41} color="#3e2723" thick={3.5} />
      <Eyes y={50} mood={mood} />
      {/* nose */}
      <path d="M60 52 Q55 66 59 69 Q64 70 65 66" fill="#dfa47c" />
      <ellipse cx="42" cy="70" rx="5" ry="3" fill="#f48fb1" opacity="0.45" />
      <ellipse cx="78" cy="70" rx="5" ry="3" fill="#f48fb1" opacity="0.45" />
      <Mouth mood={mood} y={78} />
    </g>
  );
}

export default function Caricature({ who, mood = 'neutral', size = 120, className = '' }) {
  const bg = who === 'lula' ? 'var(--red-soft)' : 'var(--blue-soft)';
  return (
    <svg
      className={`caricature ${className}`}
      viewBox="0 0 120 120"
      width={size}
      height={size}
      role="img"
      aria-label={`Caricatura satírica de ${who === 'lula' ? 'Lula' : 'Flávio'}`}
    >
      <defs>
        <clipPath id={`clip-${who}`}>
          <circle cx="60" cy="60" r="60" />
        </clipPath>
      </defs>
      <g clipPath={`url(#clip-${who})`}>
        <circle cx="60" cy="60" r="60" fill={bg} />
        {who === 'lula' ? <Lula mood={mood} /> : <Flavio mood={mood} />}
      </g>
    </svg>
  );
}

import { FACTIONS } from '../game/data.js';

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

function Cury({ mood }) {
  return (
    <g>
      {/* purple blazer over a turtleneck */}
      <path d="M12 120 Q18 92 60 90 Q102 92 108 120 Z" fill="#4a148c" />
      <path d="M44 90 Q60 99 76 90 L75 104 Q60 110 45 104 Z" fill="#8e24aa" />
      {/* head */}
      <ellipse cx="60" cy="56" rx="31" ry="35" fill="#ecc19c" />
      <ellipse cx="28" cy="60" rx="5" ry="8" fill="#dfab85" />
      <ellipse cx="92" cy="60" rx="5" ry="8" fill="#dfab85" />
      {/* silver hair, combed back */}
      <path d="M29 50 Q24 18 60 16 Q96 18 91 50 Q86 30 60 27 Q34 30 29 50 Z" fill="#eeeeee" stroke="#bdbdbd" strokeWidth="1" />
      <path d="M40 22 Q60 30 82 24" stroke="#bdbdbd" strokeWidth="1.5" fill="none" />
      <Brows mood={mood} y={40} color="#9e9e9e" thick={4} />
      <Eyes y={50} mood={mood} />
      {/* thoughtful round glasses */}
      <g fill="rgba(255,255,255,0.18)" stroke="#4a148c" strokeWidth="2.5">
        <rect x="35" y="42" width="22" height="17" rx="7" />
        <rect x="63" y="42" width="22" height="17" rx="7" />
      </g>
      <line x1="57" y1="49" x2="63" y2="49" stroke="#4a148c" strokeWidth="2.5" />
      {/* nose */}
      <path d="M60 54 Q55 67 59 70 Q64 71 65 67" fill="#d9a07a" />
      <Mouth mood={mood} y={79} />
    </g>
  );
}

function Renan({ mood }) {
  return (
    <g>
      {/* orange hoodie with drawstrings */}
      <path d="M10 120 Q16 90 60 88 Q104 90 110 120 Z" fill="#ef6c00" />
      <path d="M38 92 Q60 104 82 92" stroke="#e65100" strokeWidth="5" fill="none" />
      <line x1="52" y1="99" x2="51" y2="114" stroke="#fff3e0" strokeWidth="2" strokeLinecap="round" />
      <line x1="68" y1="99" x2="69" y2="114" stroke="#fff3e0" strokeWidth="2" strokeLinecap="round" />
      {/* head */}
      <ellipse cx="60" cy="55" rx="31" ry="35" fill="#e9b892" />
      <ellipse cx="29" cy="58" rx="5" ry="8" fill="#dca37c" />
      <ellipse cx="91" cy="58" rx="5" ry="8" fill="#dca37c" />
      {/* short dark hair with a quiff */}
      <path d="M29 46 Q26 16 58 14 Q92 14 92 46 Q88 28 74 27 Q62 22 50 28 Q36 30 29 46 Z" fill="#2b1d16" />
      <path d="M50 18 Q64 8 78 20 Q66 16 54 22 Z" fill="#2b1d16" />
      {/* dark trimmed beard */}
      <path d="M29 58 Q30 96 60 98 Q90 96 91 58 Q86 72 76 74 Q60 69 44 74 Q34 72 29 58 Z" fill="#3e2a20" />
      <Brows mood={mood} y={39} color="#2b1d16" thick={4} />
      <Eyes y={48} mood={mood} />
      {/* nose */}
      <path d="M60 50 Q54 64 58 67 Q64 68 66 64" fill="#d39a72" />
      <Mouth mood={mood} y={81} color="#fbe9e7" />
      {/* earbud mic: always streaming */}
      <path d="M91 62 Q96 78 74 84" stroke="#fafafa" strokeWidth="2" fill="none" />
      <circle cx="74" cy="84" r="2.6" fill="#e53935" />
    </g>
  );
}

function Caiado({ mood }) {
  return (
    <g>
      {/* governor's dark suit, white shirt, green tie */}
      <path d="M12 120 Q18 92 60 90 Q102 92 108 120 Z" fill="#263238" />
      <path d="M46 91 L60 110 L74 91 Z" fill="#fff" />
      <path d="M57 96 L63 96 L65 114 L60 120 L55 114 Z" fill="#2e7d32" />
      {/* lean, longer, sun-tanned face */}
      <ellipse cx="60" cy="58" rx="28" ry="36" fill="#dfa47a" />
      <ellipse cx="31" cy="60" rx="5" ry="8" fill="#cf9469" />
      <ellipse cx="89" cy="60" rx="5" ry="8" fill="#cf9469" />
      {/* tall silver quiff swept to one side */}
      <path d="M31 54 Q22 22 48 10 Q76 0 92 22 Q96 38 89 54 Q86 34 76 30 Q62 34 50 30 Q38 36 31 54 Z" fill="#d6d6d6" stroke="#9e9e9e" strokeWidth="1.2" />
      <path d="M40 24 Q54 6 84 16" stroke="#f5f5f5" strokeWidth="4" fill="none" strokeLinecap="round" />
      <path d="M46 30 Q62 18 86 28" stroke="#9e9e9e" strokeWidth="1.5" fill="none" />
      {/* forehead lines */}
      <path d="M46 36 Q60 33 74 36" stroke="#c98d68" strokeWidth="1" fill="none" opacity="0.6" />
      <Brows mood={mood} y={42} color="#757575" thick={4} />
      <Eyes y={51} mood={mood} />
      {/* long, straight nose */}
      <path d="M60 52 Q56 68 58 72 Q63 74 66 70" fill="#d69a72" />
      <path d="M44 74 Q46 82 50 84 M76 74 Q74 82 70 84" stroke="#c98d68" strokeWidth="1" fill="none" opacity="0.6" />
      <Mouth mood={mood} y={82} />
    </g>
  );
}

const FACES = { lula: Lula, flavio: Flavio, cury: Cury, renan: Renan, caiado: Caiado };

export default function Caricature({ who, mood = 'neutral', size = 120, className = '' }) {
  const Face = FACES[who];
  return (
    <svg
      className={`caricature ${who} ${className}`}
      viewBox="0 0 120 120"
      width={size}
      height={size}
      role="img"
      aria-label={`Caricatura satírica de ${FACTIONS[who].name}`}
    >
      <defs>
        <clipPath id={`clip-${who}`}>
          <circle cx="60" cy="60" r="60" />
        </clipPath>
      </defs>
      <g clipPath={`url(#clip-${who})`}>
        <circle cx="60" cy="60" r="60" fill="var(--c-soft)" />
        <Face mood={mood} />
      </g>
    </svg>
  );
}

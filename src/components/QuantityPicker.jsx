import { quickAmounts } from '../game/amounts.js';

// Same picker for occupation and movement: one tap on a quick value,
// or the slider for big stacks. Only legal values are ever offered.
export default function QuantityPicker({ label, min, max, value, onChange }) {
  const { values, showMax, slider } = quickAmounts(min, max);
  return (
    <div className="quantity">
      <p className="quantity-label">{label}</p>
      <div className="quantity-options" role="radiogroup" aria-label={label}>
        {values.map((n) => (
          <button
            key={n}
            role="radio"
            aria-checked={value === n}
            className={`qty ${value === n ? 'on' : ''}`}
            onClick={() => onChange(n)}
          >
            {n}
          </button>
        ))}
        {showMax && (
          <button role="radio" aria-checked={value === max} className={`qty max ${value === max ? 'on' : ''}`} onClick={() => onChange(max)}>
            Máx ({max})
          </button>
        )}
      </div>
      {slider && (
        <label className="quantity-slider">
          <input
            type="range"
            min={min}
            max={max}
            value={value}
            onChange={(e) => onChange(Number(e.target.value))}
            aria-label={`${label}: ${value}`}
          />
          <span className="quantity-value">{value}</span>
        </label>
      )}
    </div>
  );
}

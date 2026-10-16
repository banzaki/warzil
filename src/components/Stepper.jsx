import { useRef } from 'react';

// Compact amount control: mín · − N + · máx. Only legal values. Holding − or +
// keeps counting, for big stacks.
export default function Stepper({ label, min, max, value, onChange }) {
  const set = (n) => onChange(Math.max(min, Math.min(max, n)));
  const hold = useRef({});
  const stop = () => {
    clearTimeout(hold.current.wait);
    clearInterval(hold.current.repeat);
  };
  const press = (delta) => ({
    onClick: () => {
      // A long press already counted; its closing click must not add one more.
      if (hold.current.repeated) hold.current.repeated = false;
      else set(value + delta);
    },
    onPointerDown: () => {
      stop();
      let v = value;
      hold.current = { repeated: false };
      hold.current.wait = setTimeout(() => {
        hold.current.repeat = setInterval(() => {
          v = Math.max(min, Math.min(max, v + delta));
          hold.current.repeated = true;
          onChange(v);
        }, 70);
      }, 400);
    },
    onPointerUp: stop,
    onPointerLeave: stop,
    onPointerCancel: stop,
  });
  return (
    <div className="stepper" role="group" aria-label={label}>
      <button className="step-edge" onClick={() => set(min)} disabled={value <= min} aria-label={`Mínimo: ${min}`}>
        mín
      </button>
      <button className="step" disabled={value <= min} aria-label="Um a menos" {...press(-1)}>
        −
      </button>
      <output className="step-value" aria-live="polite">
        {value}
      </output>
      <button className="step" disabled={value >= max} aria-label="Um a mais" {...press(1)}>
        +
      </button>
      <button className="step-edge" onClick={() => set(max)} disabled={value >= max} aria-label={`Máximo: ${max}`}>
        máx
      </button>
    </div>
  );
}

import React from 'react';

// Shared pieces for every light control (fan LED, closet lights, Govee
// lights, Light Sync), so they all look and behave the same.

export const LIGHTS_CHANGED = 'pdm:lights-changed';   // "reload your state"

export const PRESETS = [
  { name: 'Warm white', red: 255, green: 160, blue: 60 },
  { name: 'White', red: 255, green: 255, blue: 255 },
  { name: 'Red', red: 255, green: 0, blue: 0 },
  { name: 'Orange', red: 255, green: 120, blue: 0 },
  { name: 'Green', red: 0, green: 255, blue: 0 },
  { name: 'Cyan', red: 0, green: 200, blue: 255 },
  { name: 'Blue', red: 0, green: 0, blue: 255 },
  { name: 'Purple', red: 160, green: 0, blue: 255 },
];

export const toHex = ({ red, green, blue }) =>
  '#' + [red, green, blue].map((v) => Number(v).toString(16).padStart(2, '0')).join('');

export const fromHex = (hex) => ({
  red: parseInt(hex.slice(1, 3), 16),
  green: parseInt(hex.slice(3, 5), 16),
  blue: parseInt(hex.slice(5, 7), 16),
});

const sameColor = (a, b) => a && b && a.red === b.red && a.green === b.green && a.blue === b.blue;

// Approximate colour of a white temperature, for showing it on screen
// (same formula as the backend's kelvin_to_rgb).
export function kelvinToRgb(kelvin) {
  const t = kelvin / 100;
  let r, g, b;
  if (t <= 66) {
    r = 255;
    g = 99.4708025861 * Math.log(t) - 161.1195681661;
    b = t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307;
  } else {
    r = 329.698727446 * (t - 60) ** -0.1332047592;
    g = 288.1221695283 * (t - 60) ** -0.0755148492;
    b = 255;
  }
  const c = (v) => Math.round(Math.max(0, Math.min(255, v)));
  return { red: c(r), green: c(g), blue: c(b) };
}

// The colour a light is showing right now (white mode → its temperature).
export const shownColor = ({ mode, color, kelvin }) =>
  mode === 'white' && kelvin ? kelvinToRgb(kelvin) : color || { red: 255, green: 255, blue: 255 };

// ---- Small building blocks ----------------------------------------------------

export function Segmented({ options, value, onChange, disabled, label }) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      style={{
        display: 'inline-flex',
        padding: '3px',
        gap: '2px',
        borderRadius: 'var(--radius-md)',
        background: 'var(--color-background)',
        border: '1px solid var(--color-border)',
      }}
    >
      {options.map(([id, text]) => {
        const active = value === id;
        return (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={disabled}
            onClick={() => onChange(id)}
            style={{
              border: 'none',
              borderRadius: '6px',
              padding: '6px 14px',
              minHeight: '30px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: disabled ? 'not-allowed' : 'pointer',
              background: active ? 'var(--color-surface)' : 'transparent',
              boxShadow: active ? 'var(--shadow-sm)' : 'none',
              color: active ? 'var(--color-text)' : 'var(--color-textSecondary)',
            }}
          >
            {text}
          </button>
        );
      })}
    </div>
  );
}

export function Slider({ label, value, display, min = 0, max = 100, step = 1, track, onChange, disabled, ends }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: '13px' }}>
        <span style={{ color: 'var(--color-textSecondary)', fontWeight: 600 }}>{label}</span>
        <span style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{display ?? value}</span>
      </div>
      <input
        className="pdm-range"
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        aria-label={label}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ '--track': track }}
      />
      {ends && (
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '-4px', fontSize: '11px', color: 'var(--color-textSecondary)' }}>
          <span>{ends[0]}</span>
          <span>{ends[1]}</span>
        </div>
      )}
    </div>
  );
}

// Filled-up-to-value track in the theme colour (fan speed etc.).
export const fillTrack = (percent, color = 'var(--color-primary)') =>
  `linear-gradient(to right, ${color} ${percent}%, var(--color-border) ${percent}%)`;

// A swatch showing a light's colour; it glows while the light is on.
export function Swatch({ color, on = true, size = 40 }) {
  const hex = toHex(color);
  return (
    <span
      aria-hidden="true"
      style={{
        flex: 'none',
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: '12px',
        background: on ? hex : 'var(--color-border)',
        boxShadow: on
          ? `0 0 14px ${hex}88, inset 0 0 0 1px var(--color-border)`
          : 'inset 0 0 0 1px var(--color-border)',
        opacity: on ? 1 : 0.6,
      }}
    />
  );
}

function ColorChoice({ color, onChange, disabled }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
      {PRESETS.map((preset) => {
        const value = { red: preset.red, green: preset.green, blue: preset.blue };
        const selected = sameColor(value, color);
        return (
          <button
            key={preset.name}
            type="button"
            title={preset.name}
            aria-label={preset.name}
            aria-pressed={selected}
            disabled={disabled}
            onClick={() => onChange(value)}
            style={{
              width: '28px',
              height: '28px',
              padding: 0,
              borderRadius: '50%',
              border: 'none',
              background: toHex(value),
              cursor: disabled ? 'not-allowed' : 'pointer',
              boxShadow: selected
                ? '0 0 0 2px var(--color-surface), 0 0 0 4px var(--color-primary)'
                : 'inset 0 0 0 1px rgba(0,0,0,0.15)',
            }}
          />
        );
      })}
      {/* Any other colour: the system picker, shown as a rainbow button. */}
      <label
        title="Custom color"
        style={{
          position: 'relative',
          width: '28px',
          height: '28px',
          borderRadius: '50%',
          cursor: disabled ? 'not-allowed' : 'pointer',
          background: 'conic-gradient(red, yellow, lime, cyan, blue, magenta, red)',
          boxShadow: PRESETS.some((p) => sameColor(p, color))
            ? 'inset 0 0 0 1px rgba(0,0,0,0.15)'
            : '0 0 0 2px var(--color-surface), 0 0 0 4px var(--color-primary)',
        }}
      >
        <input
          type="color"
          value={toHex(color)}
          disabled={disabled}
          aria-label="Custom color"
          onChange={(e) => onChange(fromHex(e.target.value))}
          style={{ position: 'absolute', inset: 0, opacity: 0, width: '100%', height: '100%', cursor: 'inherit' }}
        />
      </label>
    </div>
  );
}

const WARM_TO_COOL = 'linear-gradient(to right, #ff8a12, #ffb46b, #ffe4ce, #fff6f0, #d6e1ff)';

// Colour / white / brightness controls for one light (or for Light Sync).
// value: { mode, color, kelvin, brightness }; onChange gets the changed fields.
export function LightEditor({ value, onChange, supportsWhite = true, kelvinRange = [2000, 9000], disabled }) {
  const mode = supportsWhite ? value.mode || 'color' : 'color';
  const shown = shownColor({ ...value, mode });
  return (
    <div style={{ display: 'grid', gap: 'var(--spacing-md)' }}>
      {supportsWhite && (
        <div style={{ justifySelf: 'start' }}><Segmented
          label="Mode"
          options={[['color', 'Color'], ['white', 'White']]}
          value={mode}
          disabled={disabled}
          onChange={(m) => onChange({ mode: m }, { immediate: true })}
        /></div>
      )}

      {mode === 'white' ? (
        <Slider
          label="Temperature"
          value={value.kelvin || 4000}
          display={`${value.kelvin || 4000} K`}
          min={kelvinRange[0]}
          max={kelvinRange[1]}
          step={100}
          track={WARM_TO_COOL}
          ends={['Warm', 'Cool']}
          disabled={disabled}
          onChange={(kelvin) => onChange({ mode: 'white', kelvin })}
        />
      ) : (
        <ColorChoice color={value.color} disabled={disabled} onChange={(color) => onChange({ mode: 'color', color })} />
      )}

      <Slider
        label="Brightness"
        value={value.brightness ?? 100}
        display={`${value.brightness ?? 100}%`}
        min={1}
        track={`linear-gradient(to right, #00000033, ${toHex(shown)})`}
        disabled={disabled}
        onChange={(brightness) => onChange({ brightness })}
      />
    </div>
  );
}

// One light in a list: swatch, name, status, power switch; tap to expand.
export function LightRow({ color, on, name, detail, error, power, expanded, onExpand, children, last }) {
  return (
    <div style={{ borderBottom: last ? 'none' : '1px solid var(--color-border)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)', padding: 'var(--spacing-md) 0' }}>
        <button
          type="button"
          onClick={onExpand}
          aria-expanded={expanded}
          style={{
            flex: 1,
            minWidth: 0,
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--spacing-md)',
            background: 'none',
            border: 'none',
            padding: 0,
            color: 'inherit',
            font: 'inherit',
            textAlign: 'left',
            cursor: 'pointer',
          }}
        >
          <Swatch color={color} on={on} />
          <span style={{ minWidth: 0 }}>
            <span style={{ display: 'block', fontWeight: 600 }}>{name}</span>
            <span style={{
              display: 'block', fontSize: '12px', marginTop: '2px',
              color: error ? 'var(--color-error)' : 'var(--color-textSecondary)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {error || detail}
            </span>
          </span>
          <span aria-hidden="true" style={{
            marginLeft: 'auto', color: 'var(--color-textSecondary)',
            transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s ease',
          }}>▾</span>
        </button>
        {power}
      </div>
      {expanded && <div style={{ padding: '0 0 var(--spacing-md) 56px' }}>{children}</div>}
    </div>
  );
}

// Compact on/off switch.
export function PowerSwitch({ on, onChange, disabled, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={onChange}
      style={{
        flex: 'none',
        width: '48px',
        height: '28px',
        borderRadius: '14px',
        border: 'none',
        padding: 0,
        position: 'relative',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        background: on ? 'var(--color-success)' : 'var(--color-border)',
      }}
    >
      <span style={{
        position: 'absolute', top: '3px', left: on ? '23px' : '3px',
        width: '22px', height: '22px', borderRadius: '50%', background: '#fff',
        boxShadow: '0 1px 3px rgba(0,0,0,0.3)', transition: 'left 0.2s ease',
      }} />
    </button>
  );
}

// Calls fn with the latest arguments once calls stop for `ms`.
export function useDebounced(fn, ms) {
  const timer = React.useRef(null);
  const latest = React.useRef(fn);
  latest.current = fn;
  React.useEffect(() => () => clearTimeout(timer.current), []);
  return React.useCallback((...args) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => latest.current(...args), ms);
  }, [ms]);
}

export async function postJson(apiFetch, url, body) {
  const response = await apiFetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.detail || `HTTP ${response.status}`);
  return data;
}

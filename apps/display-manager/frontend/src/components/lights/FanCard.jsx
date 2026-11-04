import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Card, SectionHeader } from '../ui';
import { API, apiFetch } from '../../api';
import {
  LIGHTS_CHANGED, LightEditor, PowerSwitch, Slider, Swatch,
  fillTrack, postJson, useDebounced,
} from './shared';

// The Fans card: two 4010 RGB PWM fans wired in parallel (one PWM line, one
// WS2812 data line), so one speed and one LED colour drive both.
// The LED has no separate power state: "off" is brightness 0, and turning
// it back on restores the last brightness.
const DEBOUNCE_MS = 150;

function StatusDot({ ok, children }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--color-textSecondary)' }}>
      <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: ok ? 'var(--color-success)' : 'var(--color-error)' }} />
      {children}
    </span>
  );
}

export default function FanCard() {
  const [fan, setFan] = useState(null);
  const [led, setLed] = useState(null);
  const [error, setError] = useState(null);
  const lastBrightness = useRef(100);

  const loadLed = useCallback(() => {
    apiFetch(`${API}/hardware/led`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((data) => {
        setLed(data);
        if (data.brightness > 0) lastBrightness.current = data.brightness;
      })
      .catch(() => setError('Unable to load the LED'));
  }, []);

  useEffect(() => {
    apiFetch(`${API}/hardware/fan`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then(setFan)
      .catch(() => setError('Unable to load the fan'));
    loadLed();
    window.addEventListener(LIGHTS_CHANGED, loadLed);   // Light Sync changed it
    return () => window.removeEventListener(LIGHTS_CHANGED, loadLed);
  }, [loadLed]);

  async function call(path, body, apply) {
    setError(null);
    try {
      apply(await postJson(apiFetch, `${API}/hardware/${path}`, body));
    } catch (e) {
      setError(e.message);
    }
  }
  const callLater = useDebounced(call, DEBOUNCE_MS);

  const applyLed = (data) => setLed((l) => ({
    ...l,
    ...(data.color ? { color: data.color } : {}),
    ...(data.brightness_percent !== undefined ? { brightness: data.brightness_percent } : {}),
  }));

  function setSpeed(speed) {
    setFan((f) => ({ ...f, speed_percent: speed }));
    callLater('fan', { speed }, (d) => setFan((f) => ({ ...f, speed_percent: d.speed_percent })));
  }

  function changeLed(patch) {
    setLed((l) => ({ ...l, ...patch }));
    if (patch.color) callLater('led', patch.color, applyLed);
    if (patch.brightness !== undefined) {
      lastBrightness.current = patch.brightness;
      callLater('led/brightness', { brightness: patch.brightness }, applyLed);
    }
  }

  function toggleLed() {
    const on = !(led.brightness > 0);
    if (on) {
      setLed((l) => ({ ...l, brightness: lastBrightness.current }));
      call('led/brightness', { brightness: lastBrightness.current }, applyLed);
    } else {
      setLed((l) => ({ ...l, brightness: 0 }));
      call('led/off', {}, applyLed);
    }
  }

  const speed = Math.round(fan?.speed_percent ?? 0);
  const ledOn = (led?.brightness ?? 0) > 0;

  return (
    <div style={{ flex: '1 1 300px', minWidth: 0 }}>
      <SectionHeader title="Fans" />
      <Card>
        {/* FAN */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--spacing-md)' }}>
          <div>
            <div style={{ fontWeight: 600 }}>2 × 4010 PWM fans</div>
            <div style={{ fontSize: '12px', color: 'var(--color-textSecondary)', marginTop: '2px' }}>GPIO 18 · pin 12 · 25 kHz</div>
          </div>
          {fan && <StatusDot ok={fan.available}>{fan.simulated ? 'Simulated' : fan.available ? 'Available' : 'Unavailable'}</StatusDot>}
        </div>

        <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', margin: 'var(--spacing-md) 0 0' }}>
          <span style={{ fontSize: '36px', fontWeight: 700, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{speed}</span>
          <span style={{ fontSize: '16px', color: 'var(--color-textSecondary)', fontWeight: 600 }}>%</span>
          <span style={{ marginLeft: 'auto', fontSize: '13px', color: 'var(--color-textSecondary)' }}>
            {speed === 0 ? 'Off' : speed < 40 ? 'Quiet' : speed < 75 ? 'Medium' : 'Full'}
          </span>
        </div>
        <Slider
          label="Speed"
          value={speed}
          display=" "
          track={fillTrack(speed)}
          disabled={!fan?.available}
          onChange={setSpeed}
        />
        <div style={{ display: 'flex', gap: '8px' }}>
          {[0, 50, 100].map((v) => (
            <button
              key={v}
              type="button"
              disabled={!fan?.available}
              onClick={() => setSpeed(v)}
              style={{
                flex: 1, padding: '6px 0', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
                borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)',
                background: speed === v ? 'var(--color-primary)' : 'transparent',
                color: speed === v ? '#fff' : 'var(--color-text)',
              }}
            >
              {v === 0 ? 'Off' : `${v}%`}
            </button>
          ))}
        </div>

        <hr style={{ border: 0, borderTop: '1px solid var(--color-border)', margin: 'var(--spacing-lg) 0' }} />

        {/* FAN LED */}
        {led && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)', marginBottom: 'var(--spacing-md)' }}>
              <Swatch color={led.color} on={ledOn} size={36} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600 }}>Fan LEDs</div>
                <div style={{ fontSize: '12px', color: 'var(--color-textSecondary)', marginTop: '2px' }}>
                  {ledOn ? `On · ${Math.round(led.brightness)}%` : 'Off'} · WS2812 · GPIO 10
                </div>
              </div>
              <PowerSwitch on={ledOn} onChange={toggleLed} disabled={!led.available} label="Fan LEDs" />
            </div>
            <LightEditor
              value={{ mode: 'color', color: led.color, brightness: Math.round(led.brightness) || lastBrightness.current }}
              supportsWhite={false}
              disabled={!led.available}
              onChange={changeLed}
            />
          </>
        )}

        {error && (
          <div style={{
            marginTop: 'var(--spacing-md)', padding: 'var(--spacing-sm)', borderRadius: 'var(--radius-md)',
            background: 'var(--color-error)', color: '#fff', fontSize: '13px',
          }}>
            {error}
          </div>
        )}
      </Card>
    </div>
  );
}

import React, { useCallback, useEffect, useState } from 'react';
import { Card, SectionHeader } from '../ui';
import { API, apiFetch } from '../../api';
import {
  LIGHTS_CHANGED, LightEditor, LightRow, PowerSwitch, Swatch,
  postJson, shownColor, useDebounced,
} from './shared';

// The Lights card: Light Sync at the top, then one row per light
// (closet lights = the Bluetooth strip, then each Govee light). Tap a row
// to show its controls. Every change is debounced, since the lights are
// reached over Bluetooth or Wi-Fi.
const DEBOUNCE_MS = 250;

function useReloadOnLightsChanged(load) {
  useEffect(() => {
    load();
    window.addEventListener(LIGHTS_CHANGED, load);
    return () => window.removeEventListener(LIGHTS_CHANGED, load);
  }, [load]);
}

// ---- Light Sync -------------------------------------------------------------------

function SyncPanel({ sync, setSync }) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState([]);
  const [error, setError] = useState(null);

  async function send(next) {
    setBusy(true);
    setError(null);
    try {
      const data = await postJson(apiFetch, `${API}/hardware/sync`, {
        enabled: next.enabled, mode: next.mode, color: next.color, kelvin: next.kelvin, brightness: next.brightness,
      });
      setSync(data);
      setFailed((data.results || []).filter((r) => !r.ok));
      if (data.results?.length) window.dispatchEvent(new Event(LIGHTS_CHANGED));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  const sendLater = useDebounced(send, DEBOUNCE_MS);

  function change(patch, { immediate } = {}) {
    const next = { ...sync, ...patch };
    setSync(next);
    (immediate ? send : sendLater)(next);
  }

  function toggle() {
    const next = { ...sync, enabled: !sync.enabled };
    setSync(next);
    if (!next.enabled) setFailed([]);
    send(next);
  }

  const problem = error || (failed.length ? failed.map((r) => `${r.name}: ${r.error}`).join(' · ') : null);

  return (
    <div style={{
      padding: 'var(--spacing-md)',
      borderRadius: 'var(--radius-md)',
      background: 'var(--color-background)',
      border: '1px solid var(--color-border)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)' }}>
        <Swatch color={shownColor(sync)} on={sync.enabled} size={36} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600 }}>Sync all lights</div>
          <div style={{ fontSize: '12px', marginTop: '2px', color: problem ? 'var(--color-error)' : 'var(--color-textSecondary)' }}>
            {problem || (busy ? 'Syncing…' : sync.enabled ? 'Changes here go to every light' : 'One color for every light')}
          </div>
        </div>
        <PowerSwitch on={sync.enabled} onChange={toggle} label="Sync all lights" />
      </div>

      {sync.enabled && (
        <div style={{ marginTop: 'var(--spacing-md)' }}>
          <LightEditor
            value={sync}
            kelvinRange={sync.kelvin_range}
            onChange={change}
          />
          {sync.mode === 'white' && (
            <div style={{ marginTop: 'var(--spacing-sm)', fontSize: '12px', color: 'var(--color-textSecondary)' }}>
              Govee lights use their white LEDs; the others show the nearest color.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---- Closet lights (Bluetooth strip) -------------------------------------------

function ClosetRow({ synced, expanded, onExpand, last }) {
  const [strip, setStrip] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    apiFetch(`${API}/hardware/strip`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then(setStrip)
      .catch(() => setError('Unable to load'));
  }, []);
  useReloadOnLightsChanged(load);

  async function send(path, body) {
    setBusy(true);
    setError(null);
    try {
      const data = await postJson(apiFetch, `${API}/hardware/strip/${path}`, body);
      setStrip((s) => ({ ...s, ...data, connected: true }));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  const sendLater = useDebounced(send, DEBOUNCE_MS);

  if (!strip) return null;
  if (!strip.available) return null;   // no strip configured

  function change(patch) {
    setStrip((s) => ({ ...s, ...patch, on: true }));
    if (patch.color) sendLater('color', patch.color);
    if (patch.brightness !== undefined) sendLater('brightness', { brightness: patch.brightness });
  }

  const detail = [
    strip.on ? `On · ${strip.brightness}%` : 'Off',
    synced ? 'Synced' : null,
    busy ? 'Sending…' : strip.simulated ? 'Simulated' : 'Bluetooth',
  ].filter(Boolean).join(' · ');

  return (
    <LightRow
      name="Closet lights"
      color={strip.color}
      on={strip.on}
      detail={detail}
      error={error}
      expanded={expanded}
      onExpand={onExpand}
      last={last}
      power={(
        <PowerSwitch
          on={strip.on}
          label="Closet lights"
          onChange={() => {
            const on = !strip.on;
            setStrip((s) => ({ ...s, on }));
            send('power', { on });
          }}
        />
      )}
    >
      <LightEditor value={{ ...strip, mode: 'color' }} supportsWhite={false} onChange={change} />
    </LightRow>
  );
}

// ---- Govee lights ----------------------------------------------------------------

function GoveeRow({ initial, synced, expanded, onExpand, last }) {
  const [light, setLight] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const index = initial.index;

  useEffect(() => {
    setLight(initial);
    setError(initial.online === false ? initial.error : null);
  }, [initial]);

  async function send(path, body) {
    setBusy(true);
    setError(null);
    try {
      const data = await postJson(apiFetch, `${API}/hardware/govee/${index}${path}`, body);
      if (!data.pending) setLight(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  const sendLater = useDebounced(send, DEBOUNCE_MS);

  const online = light.online !== false;
  const mode = light.kelvin ? 'white' : 'color';

  function change(patch, { immediate } = {}) {
    const next = { ...light, on: true };
    if (patch.mode === 'white') next.kelvin = patch.kelvin || light.kelvin || 4000;
    if (patch.mode === 'color') { next.kelvin = 0; if (patch.color) next.color = patch.color; }
    if (patch.brightness !== undefined) next.brightness = patch.brightness;
    setLight(next);
    const go = immediate ? send : sendLater;
    if (patch.brightness !== undefined) go('/brightness', { brightness: patch.brightness });
    else if (next.kelvin) go('/kelvin', { kelvin: next.kelvin });
    else go('/color', next.color);
  }

  const detail = !online ? null : [
    light.on ? `On · ${light.brightness}%` : 'Off',
    light.on && light.kelvin ? `${light.kelvin} K` : null,
    synced ? 'Synced' : null,
    busy ? 'Sending…' : light.simulated ? 'Simulated' : 'Wi-Fi',
  ].filter(Boolean).join(' · ');

  return (
    <LightRow
      name={light.name}
      color={shownColor({ mode, color: light.color, kelvin: light.kelvin })}
      on={online && light.on}
      detail={detail}
      error={error || (!online ? 'Offline' : null)}
      expanded={expanded}
      onExpand={onExpand}
      last={last}
      power={(
        <PowerSwitch
          on={Boolean(light.on)}
          disabled={!online}
          label={light.name}
          onChange={() => {
            const on = !light.on;
            setLight((l) => ({ ...l, on }));
            send('/power', { on });
          }}
        />
      )}
    >
      <LightEditor
        value={{ ...light, mode }}
        kelvinRange={light.kelvin_range}
        disabled={!online}
        onChange={change}
      />
    </LightRow>
  );
}

// ---- The card ---------------------------------------------------------------------

export default function LightsCard() {
  const [sync, setSync] = useState(null);
  const [govee, setGovee] = useState([]);
  const [open, setOpen] = useState(null);   // which row is expanded

  const load = useCallback(() => {
    apiFetch(`${API}/hardware/govee`).then((r) => (r.ok ? r.json() : [])).then(setGovee).catch(() => setGovee([]));
  }, []);
  useReloadOnLightsChanged(load);

  useEffect(() => {
    apiFetch(`${API}/hardware/sync`).then((r) => (r.ok ? r.json() : null)).then(setSync).catch(() => {});
  }, []);

  const rows = [
    { key: 'closet', render: (props) => <ClosetRow {...props} /> },
    ...govee.map((light) => ({ key: `govee-${light.index}`, render: (props) => <GoveeRow initial={light} {...props} /> })),
  ];

  return (
    <div style={{ flex: '2 1 460px', minWidth: 0 }}>
      <SectionHeader
        title="Lights"
        action={(
          <button
            type="button"
            title="Refresh all lights"
            aria-label="Refresh all lights"
            onClick={() => window.dispatchEvent(new Event(LIGHTS_CHANGED))}
            style={{
              border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)',
              borderRadius: 'var(--radius-md)', width: '32px', height: '28px', margin: '-4px 0', cursor: 'pointer', fontSize: '15px', lineHeight: 1,
            }}
          >
            ↻
          </button>
        )}
      />
      <Card>
        {sync && <SyncPanel sync={sync} setSync={setSync} />}

        <div style={{ marginTop: 'var(--spacing-sm)' }}>
          {rows.map((row, i) => (
            <React.Fragment key={row.key}>
              {row.render({
                synced: Boolean(sync?.enabled),
                expanded: open === row.key,
                onExpand: () => setOpen(open === row.key ? null : row.key),
                last: i === rows.length - 1,
              })}
            </React.Fragment>
          ))}
        </div>
      </Card>
    </div>
  );
}

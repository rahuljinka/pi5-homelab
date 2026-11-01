import React, { useEffect, useState } from 'react';
import { Card, Button, SectionHeader } from './ui';

import { API as API_URL, apiFetch } from "../api";

export default function HardwareControls() {
  // ============================================================
  // LED STATE
  // ============================================================

  const [ledColor, setLedColor] = useState({
    red: 0,
    green: 0,
    blue: 0,
  });

  const [brightness, setBrightness] = useState(100);
  const [ledAvailable, setLedAvailable] = useState(false);
  const [loadingLED, setLoadingLED] = useState(true);
  const [ledError, setLedError] = useState(null);

  // ============================================================
  // FAN STATE
  // ============================================================

  const [fanSpeed, setFanSpeed] = useState(0);
  const [fanAvailable, setFanAvailable] = useState(false);
  const [loadingFan, setLoadingFan] = useState(true);
  const [fanError, setFanError] = useState(null);

  // ============================================================
  // LOAD HARDWARE STATE
  // ============================================================

  useEffect(() => {
    loadHardwareState();
  }, []);

  async function loadHardwareState() {
    await Promise.all([
      loadLEDState(),
      loadFanState(),
    ]);
  }

  // ============================================================
  // LOAD LED STATE
  // ============================================================

  async function loadLEDState() {
    try {
      setLoadingLED(true);
      setLedError(null);

      const response = await apiFetch(
        `${API_URL}/hardware/led`
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();

      setLedAvailable(data.available);

      if (data.color) {
        setLedColor({
          red: data.color.red ?? 0,
          green: data.color.green ?? 0,
          blue: data.color.blue ?? 0,
        });
      }

      if (data.brightness !== undefined) {
        setBrightness(Number(data.brightness));
      }

    } catch (error) {
      console.error(
        'Failed to load LED state:',
        error
      );

      setLedError(
        'Unable to connect to LED controller'
      );

    } finally {
      setLoadingLED(false);
    }
  }

  // ============================================================
  // LOAD FAN STATE
  // ============================================================

  async function loadFanState() {
    try {
      setLoadingFan(true);
      setFanError(null);

      const response = await apiFetch(
        `${API_URL}/hardware/fan`
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();

      setFanAvailable(data.available);

      if (data.speed_percent !== undefined) {
        setFanSpeed(
          Number(data.speed_percent)
        );
      }

    } catch (error) {
      console.error(
        'Failed to load fan state:',
        error
      );

      setFanError(
        'Unable to connect to fan controller'
      );

    } finally {
      setLoadingFan(false);
    }
  }

  // ============================================================
  // SET FAN SPEED
  // ============================================================

  async function updateFanSpeed(newSpeed) {
    const value = Number(newSpeed);

    // Update UI immediately
    setFanSpeed(value);

    try {
      setFanError(null);

      const response = await apiFetch(
        `${API_URL}/hardware/fan`,
        {
          method: 'POST',

          headers: {
            'Content-Type':
              'application/json',
          },

          body: JSON.stringify({
            speed: value,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(
          `HTTP ${response.status}`
        );
      }

      const data = await response.json();

      if (data.speed_percent !== undefined) {
        setFanSpeed(
          Number(data.speed_percent)
        );
      }

    } catch (error) {
      console.error(
        'Failed to update fan speed:',
        error
      );

      setFanError(
        'Failed to update fan speed'
      );
    }
  }

  // ============================================================
  // TURN FAN OFF
  // ============================================================

  async function turnFanOff() {
    try {
      setFanError(null);

      const response = await apiFetch(
        `${API_URL}/hardware/fan/off`,
        {
          method: 'POST',
        }
      );

      if (!response.ok) {
        throw new Error(
          `HTTP ${response.status}`
        );
      }

      const data = await response.json();

      if (data.speed_percent !== undefined) {
        setFanSpeed(
          Number(data.speed_percent)
        );
      } else {
        setFanSpeed(0);
      }

    } catch (error) {
      console.error(
        'Failed to turn fan off:',
        error
      );

      setFanError(
        'Failed to turn fan off'
      );
    }
  }

  // ============================================================
  // SET LED COLOR
  // ============================================================

  async function updateLEDColor(
    red,
    green,
    blue
  ) {
    try {
      setLedError(null);

      const response = await apiFetch(
        `${API_URL}/hardware/led`,
        {
          method: 'POST',

          headers: {
            'Content-Type':
              'application/json',
          },

          body: JSON.stringify({
            red,
            green,
            blue,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(
          `HTTP ${response.status}`
        );
      }

      const data = await response.json();

      if (data.color) {
        setLedColor(data.color);
      }

      if (
        data.brightness_percent !== undefined
      ) {
        setBrightness(
          Number(data.brightness_percent)
        );
      }

    } catch (error) {
      console.error(
        'Failed to update LED color:',
        error
      );

      setLedError(
        'Failed to update LED color'
      );
    }
  }

  // ============================================================
  // SET LED BRIGHTNESS
  // ============================================================

  async function updateBrightness(
    newBrightness
  ) {
    const value = Number(newBrightness);

    // Update UI immediately
    setBrightness(value);

    try {
      setLedError(null);

      const response = await apiFetch(
        `${API_URL}/hardware/led/brightness`,
        {
          method: 'POST',

          headers: {
            'Content-Type':
              'application/json',
          },

          body: JSON.stringify({
            brightness: value,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(
          `HTTP ${response.status}`
        );
      }

      const data = await response.json();

      if (
        data.brightness_percent !== undefined
      ) {
        setBrightness(
          Number(data.brightness_percent)
        );
      }

      if (data.color) {
        setLedColor(data.color);
      }

    } catch (error) {
      console.error(
        'Failed to update brightness:',
        error
      );

      setLedError(
        'Failed to update brightness'
      );
    }
  }

  // ============================================================
  // TURN LED OFF
  // ============================================================

  async function turnLEDOff() {
    try {
      setLedError(null);

      const response = await apiFetch(
        `${API_URL}/hardware/led/off`,
        {
          method: 'POST',
        }
      );

      if (!response.ok) {
        throw new Error(
          `HTTP ${response.status}`
        );
      }

      const data = await response.json();

      if (data.color) {
        setLedColor(data.color);
      }

      if (
        data.brightness_percent !== undefined
      ) {
        setBrightness(
          Number(data.brightness_percent)
        );
      }

    } catch (error) {
      console.error(
        'Failed to turn LED off:',
        error
      );

      setLedError(
        'Failed to turn LED off'
      );
    }
  }

  // ============================================================
  // COLOR HELPERS
  // ============================================================

  function rgbToHex(
    red,
    green,
    blue
  ) {
    return (
      '#' +
      [red, green, blue]
        .map((value) =>
          Number(value)
            .toString(16)
            .padStart(2, '0')
        )
        .join('')
    );
  }

  function hexToRGB(hex) {
    const cleanHex =
      hex.replace('#', '');

    return {
      red: parseInt(
        cleanHex.substring(0, 2),
        16
      ),

      green: parseInt(
        cleanHex.substring(2, 4),
        16
      ),

      blue: parseInt(
        cleanHex.substring(4, 6),
        16
      ),
    };
  }

  function handleColorChange(event) {
    const color = hexToRGB(
      event.target.value
    );

    setLedColor(color);

    updateLEDColor(
      color.red,
      color.green,
      color.blue
    );
  }

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <div
      style={{
        width: '100%',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
        gap: 'var(--spacing-lg)',
      }}
    >

      {/* ======================================================
          FAN CONTROLS
      ======================================================= */}

      <div>

        <SectionHeader
          title="Fan Controls"
        />

        <Card>

          {/* FAN STATUS */}

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent:
                'space-between',
              marginBottom:
                'var(--spacing-lg)',
              gap:
                'var(--spacing-md)',
              flexWrap:
                'wrap',
            }}
          >

            <div>

              <div
                style={{
                  fontWeight: '600',
                  fontSize: '16px',
                }}
              >
                PWM Fan
              </div>

              <div
                style={{
                  fontSize: '13px',
                  color:
                    'var(--color-textSecondary)',
                  marginTop:
                    '4px',
                }}
              >
                GPIO 18 · Physical Pin 12 · 25 kHz
              </div>

            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >

              <div
                style={{
                  width: '10px',
                  height: '10px',
                  borderRadius: '50%',
                  backgroundColor:
                    fanAvailable
                      ? 'var(--color-success)'
                      : 'var(--color-error)',
                }}
              />

              <span
                style={{
                  fontSize: '13px',
                }}
              >
                {fanAvailable
                  ? 'Available'
                  : 'Unavailable'}
              </span>

            </div>

          </div>


          {/* FAN SPEED */}

          <div
            style={{
              marginBottom:
                'var(--spacing-xl)',
            }}
          >

            <div
              style={{
                display: 'flex',
                justifyContent:
                  'space-between',
                alignItems:
                  'center',
                marginBottom:
                  'var(--spacing-sm)',
              }}
            >

              <label
                style={{
                  fontWeight: '600',
                }}
              >
                Fan Speed
              </label>

              <span
                style={{
                  fontWeight: '600',
                  color:
                    'var(--color-primary)',
                }}
              >
                {Math.round(
                  fanSpeed
                )}%
              </span>

            </div>

            <input
              type="range"

              min="0"

              max="100"

              step="1"

              value={fanSpeed}

              onChange={(event) =>
                updateFanSpeed(
                  event.target.value
                )
              }

              disabled={
                !fanAvailable ||
                loadingFan
              }

              style={{
                width: '100%',
                cursor: 'pointer',
              }}
            />

            <div
              style={{
                display: 'flex',
                justifyContent:
                  'space-between',
                marginTop: '4px',
                fontSize: '12px',
                color:
                  'var(--color-textSecondary)',
              }}
            >

              <span>0%</span>

              <span>50%</span>

              <span>100%</span>

            </div>

          </div>


          {/* FAN ACTIONS */}

          <div
            style={{
              display: 'flex',
              gap:
                'var(--spacing-sm)',
              flexWrap:
                'wrap',
            }}
          >

            <Button
              variant="danger"
              onClick={
                turnFanOff
              }
              disabled={
                !fanAvailable ||
                loadingFan
              }
            >
              Turn Fan Off
            </Button>

            <Button
              variant="ghost"
              onClick={
                loadFanState
              }
              disabled={
                loadingFan
              }
            >
              Refresh
            </Button>

          </div>


          {/* FAN ERROR */}

          {fanError && (
            <div
              style={{
                marginTop:
                  'var(--spacing-md)',
                padding:
                  'var(--spacing-sm)',
                borderRadius:
                  'var(--radius-md)',
                backgroundColor:
                  'var(--color-error)',
                color: '#ffffff',
                fontSize: '13px',
              }}
            >
              {fanError}
            </div>
          )}

        </Card>

      </div>


      {/* ======================================================
          LED CONTROLS
      ======================================================= */}

      <div>

        <SectionHeader
          title="LED Controls"
        />

        <Card>

          {/* LED STATUS */}

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent:
                'space-between',
              marginBottom:
                'var(--spacing-lg)',
              gap:
                'var(--spacing-md)',
              flexWrap:
                'wrap',
            }}
          >

            <div>

              <div
                style={{
                  fontWeight: '600',
                  fontSize: '16px',
                }}
              >
                WS2812 LED
              </div>

              <div
                style={{
                  fontSize: '13px',
                  color:
                    'var(--color-textSecondary)',
                  marginTop:
                    '4px',
                }}
              >
                GPIO 10 · SPI0.0 · 1 LED
              </div>

            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >

              <div
                style={{
                  width: '10px',
                  height: '10px',
                  borderRadius: '50%',
                  backgroundColor:
                    ledAvailable
                      ? 'var(--color-success)'
                      : 'var(--color-error)',
                }}
              />

              <span
                style={{
                  fontSize: '13px',
                }}
              >
                {ledAvailable
                  ? 'Available'
                  : 'Unavailable'}
              </span>

            </div>

          </div>


          {/* COLOR */}

          <div
            style={{
              marginBottom:
                'var(--spacing-xl)',
            }}
          >

            <label
              style={{
                display: 'block',
                fontWeight: '600',
                marginBottom:
                  'var(--spacing-sm)',
              }}
            >
              Color
            </label>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap:
                  'var(--spacing-md)',
              }}
            >

              <input
                type="color"

                value={rgbToHex(
                  ledColor.red,
                  ledColor.green,
                  ledColor.blue
                )}

                onChange={
                  handleColorChange
                }

                disabled={
                  !ledAvailable ||
                  loadingLED
                }

                style={{
                  width: '64px',
                  height: '48px',
                  padding: '2px',
                  border:
                    '1px solid var(--color-border)',
                  borderRadius:
                    'var(--radius-md)',
                  cursor:
                    'pointer',
                  background:
                    'var(--color-surface)',
                }}
              />

              <div>

                <div
                  style={{
                    fontWeight: '600',
                  }}
                >
                  RGB
                </div>

                <div
                  style={{
                    fontSize: '13px',
                    color:
                      'var(--color-textSecondary)',
                  }}
                >
                  {ledColor.red}, {ledColor.green},{' '}
                  {ledColor.blue}
                </div>

              </div>

            </div>

          </div>


          {/* BRIGHTNESS */}

          <div
            style={{
              marginBottom:
                'var(--spacing-xl)',
            }}
          >

            <div
              style={{
                display: 'flex',
                justifyContent:
                  'space-between',
                alignItems:
                  'center',
                marginBottom:
                  'var(--spacing-sm)',
              }}
            >

              <label
                style={{
                  fontWeight: '600',
                }}
              >
                Brightness
              </label>

              <span
                style={{
                  fontWeight: '600',
                  color:
                    'var(--color-primary)',
                }}
              >
                {Math.round(
                  brightness
                )}%
              </span>

            </div>

            <input
              type="range"

              min="0"

              max="100"

              step="1"

              value={brightness}

              onChange={(event) =>
                updateBrightness(
                  event.target.value
                )
              }

              disabled={
                !ledAvailable ||
                loadingLED
              }

              style={{
                width: '100%',
                cursor: 'pointer',
              }}
            />

            <div
              style={{
                display: 'flex',
                justifyContent:
                  'space-between',
                marginTop: '4px',
                fontSize: '12px',
                color:
                  'var(--color-textSecondary)',
              }}
            >

              <span>0%</span>

              <span>50%</span>

              <span>100%</span>

            </div>

          </div>


          {/* LED ACTIONS */}

          <div
            style={{
              display: 'flex',
              gap:
                'var(--spacing-sm)',
              flexWrap:
                'wrap',
            }}
          >

            <Button
              variant="danger"
              onClick={
                turnLEDOff
              }
              disabled={
                !ledAvailable ||
                loadingLED
              }
            >
              Turn LED Off
            </Button>

            <Button
              variant="ghost"
              onClick={
                loadLEDState
              }
              disabled={
                loadingLED
              }
            >
              Refresh
            </Button>

          </div>


          {/* LED ERROR */}

          {ledError && (
            <div
              style={{
                marginTop:
                  'var(--spacing-md)',
                padding:
                  'var(--spacing-sm)',
                borderRadius:
                  'var(--radius-md)',
                backgroundColor:
                  'var(--color-error)',
                color: '#ffffff',
                fontSize: '13px',
              }}
            >
              {ledError}
            </div>
          )}

        </Card>

      </div>


    </div>
  );
}

import React from 'react';
import FanCard from './lights/FanCard';
import LightsCard from './lights/LightsCard';

// Fan (with its LED) beside the Lights card (Light Sync, closet lights,
// Govee lights). Side by side on wide screens, stacked on phones.
export default function HardwareControls() {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--spacing-lg)', alignItems: 'flex-start' }}>
      <FanCard />
      <LightsCard />
    </div>
  );
}

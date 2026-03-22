import React, { useState, useCallback } from 'react'
import { Canvas } from '@react-three/fiber'
import LavaLampScene from './LavaLampScene'
import SettingsMenu from './SettingsMenu'
import './styles.css'

const PALETTES = [
  { name: 'Classic', blob: [1.0, 0.2, 0.0],   glow: [1.0, 0.53, 0.0] },
  { name: 'Ocean',   blob: [0.0, 0.53, 1.0],  glow: [0.0, 1.0, 0.8] },
  { name: 'Toxic',   blob: [0.27, 1.0, 0.0],  glow: [0.67, 1.0, 0.0] },
  { name: 'Cosmic',  blob: [0.67, 0.0, 1.0],  glow: [1.0, 0.0, 0.67] },
  { name: 'Ember',   blob: [1.0, 0.4, 0.0],   glow: [1.0, 0.8, 0.0] },
]

export default function App() {
  const [settings, setSettings] = useState({
    paletteIdx: 0,
    bloomIntensity: 1.2,
    speed: 'medium',
    gooeyness: 0.26,
    blobCount: 10,
    bgBrightness: 'pitch',
  })

  const updateSetting = useCallback((key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }))
  }, [])

  return (
    <>
      <Canvas
        gl={{ antialias: true, alpha: false }}
        style={{ position: 'fixed', inset: 0, background: '#08080f' }}
        camera={{ position: [0, 0, 5.5], fov: 42, near: 0.1, far: 100 }}
      >
        <LavaLampScene palette={PALETTES[settings.paletteIdx]} settings={settings} />
      </Canvas>
      <SettingsMenu
        settings={settings}
        updateSetting={updateSetting}
        palettes={PALETTES}
      />
      <div style={{
        position: 'fixed',
        bottom: 12,
        left: 0,
        right: 0,
        textAlign: 'center',
        color: 'rgba(255,255,255,0.35)',
        fontSize: 13,
        fontFamily: 'sans-serif',
        pointerEvents: 'auto',
      }}>
        Made for fun by{' '}
        <a
          href="https://rodonguyen.dev"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: 'rgba(255,255,255,0.5)', textDecoration: 'underline' }}
        >
          Rodo
        </a>
      </div>
    </>
  )
}

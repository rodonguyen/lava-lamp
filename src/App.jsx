import React, { useState, useCallback } from 'react'
import { Canvas } from '@react-three/fiber'
import LavaLampScene from './LavaLampScene'
import SettingsMenu from './SettingsMenu'
import './styles.css'

const PALETTES = [
  { name: 'Classic', bottom: [1.0, 0.2, 0.0],   top: [1.0, 0.53, 0.0] },
  { name: 'Ocean',   bottom: [0.0, 0.53, 1.0],  top: [0.0, 1.0, 0.8] },
  { name: 'Toxic',   bottom: [0.27, 1.0, 0.0],  top: [0.67, 1.0, 0.0] },
  { name: 'Cosmic',  bottom: [0.67, 0.0, 1.0],  top: [1.0, 0.0, 0.67] },
  { name: 'Ember',   bottom: [1.0, 0.4, 0.0],   top: [1.0, 0.8, 0.0] },
]

const WATER_PALETTES = [
  { name: 'Clear',   color: [0.02, 0.02, 0.03] },
  { name: 'Amber',   color: [0.15, 0.05, 0.0] },
  { name: 'Deep',    color: [0.0, 0.1, 0.2] },
  { name: 'Acid',    color: [0.05, 0.15, 0.0] },
  { name: 'Violet',  color: [0.1, 0.0, 0.15] },
]

export default function App() {
  const [settings, setSettings] = useState({
    paletteIdx: 0,
    waterPaletteIdx: 0,
    bloomIntensity: 1.2,
    topLight: 0.7,
    bottomLight: 1.0,
    waterStrength: 0.5,
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
        <LavaLampScene palette={PALETTES[settings.paletteIdx]} waterPalette={WATER_PALETTES[settings.waterPaletteIdx]} settings={settings} />
      </Canvas>
      <SettingsMenu
        settings={settings}
        updateSetting={updateSetting}
        palettes={PALETTES}
        waterPalettes={WATER_PALETTES}
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
        {' | '}
        <a
          href="https://github.com/rodonguyen/lava-lamp"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: 'rgba(255,255,255,0.5)', textDecoration: 'underline' }}
        >
          GitHub repo
        </a>, fork or contributions welcome!
      </div>
    </>
  )
}

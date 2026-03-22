import React, { useState, useCallback, useRef } from 'react'

const SPEED_OPTIONS = ['slow', 'medium', 'fast']
const BG_OPTIONS = ['dark', 'darker', 'pitch']

function PillGroup({ options, value, onChange, labels }) {
  return (
    <div className="pill-group">
      {options.map((opt, i) => (
        <button
          key={opt}
          className={`pill ${value === opt ? 'pill-active' : ''}`}
          onClick={() => onChange(opt)}
        >
          {labels ? labels[i] : opt}
        </button>
      ))}
    </div>
  )
}

export default function SettingsMenu({ settings, updateSetting, palettes }) {
  const [open, setOpen] = useState(false)
  const closeTimer = useRef(null)

  const handleFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen()
    } else {
      document.documentElement.requestFullscreen()
    }
  }, [])

  const isTouchDevice = typeof window !== 'undefined' && window.matchMedia('(hover: none)').matches

  const handleEnter = () => {
    clearTimeout(closeTimer.current)
    setOpen(true)
  }

  const handleLeave = () => {
    closeTimer.current = setTimeout(() => setOpen(false), 400)
  }

  const containerProps = isTouchDevice
    ? {}
    : { onMouseEnter: handleEnter, onMouseLeave: handleLeave }

  const gearClick = isTouchDevice ? () => setOpen(o => !o) : undefined

  return (
    <div className="settings-container" {...containerProps}>
      <button className="settings-gear" onClick={gearClick} aria-label="Settings">
        &#9881;
      </button>
      {open && (
        <div className="settings-dropdown">
          {/* Palette */}
          <div className="settings-row">
            <span className="settings-label">Palette</span>
            <div className="swatch-group">
              {palettes.map((p, i) => (
                <button
                  key={p.name}
                  className={`swatch ${settings.paletteIdx === i ? 'swatch-active' : ''}`}
                  style={{
                    background: `rgb(${p.blob.map(v => Math.round(v * 255)).join(',')})`,
                  }}
                  onClick={() => updateSetting('paletteIdx', i)}
                  title={p.name}
                />
              ))}
            </div>
          </div>

          {/* Bloom */}
          <div className="settings-row">
            <span className="settings-label">Bloom</span>
            <input
              type="range"
              className="settings-slider"
              min="0"
              max="3"
              step="0.1"
              value={settings.bloomIntensity}
              onChange={e => updateSetting('bloomIntensity', parseFloat(e.target.value))}
            />
          </div>

          {/* Speed */}
          <div className="settings-row">
            <span className="settings-label">Speed</span>
            <PillGroup
              options={SPEED_OPTIONS}
              value={settings.speed}
              onChange={v => updateSetting('speed', v)}
            />
          </div>

          {/* Gooeyness */}
          <div className="settings-row">
            <span className="settings-label">Gooey</span>
            <input
              type="range"
              className="settings-slider"
              min="0.18"
              max="0.35"
              step="0.01"
              value={settings.gooeyness}
              onChange={e => updateSetting('gooeyness', parseFloat(e.target.value))}
            />
          </div>

          {/* Blob count */}
          <div className="settings-row">
            <span className="settings-label">Blobs ({settings.blobCount})</span>
            <input
              type="range"
              className="settings-slider"
              min="2"
              max="20"
              step="1"
              value={settings.blobCount}
              onChange={e => updateSetting('blobCount', parseInt(e.target.value))}
            />
          </div>

          {/* Background */}
          <div className="settings-row">
            <span className="settings-label">Background</span>
            <PillGroup
              options={BG_OPTIONS}
              value={settings.bgBrightness}
              onChange={v => updateSetting('bgBrightness', v)}
            />
          </div>

          {/* Fullscreen */}
          <div className="settings-row">
            <span className="settings-label">Fullscreen</span>
            <button className="pill" onClick={handleFullscreen}>
              &#x26F6;
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

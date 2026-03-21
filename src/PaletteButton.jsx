import React from 'react'

export default function PaletteButton({ name, onClick }) {
  return (
    <button className="palette-btn" onClick={onClick}>
      {name}
    </button>
  )
}

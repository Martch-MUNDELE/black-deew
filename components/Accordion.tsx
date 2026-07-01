'use client'
import { useState } from 'react'

type AccordionProps = {
  header: React.ReactNode
  children: React.ReactNode
  defaultOpen?: boolean
}

export default function Accordion({ header, children, defaultOpen = false }: AccordionProps) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div style={{ border: '1px solid rgba(232,160,32,0.12)', borderRadius: 8, overflow: 'hidden' }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'transparent', border: 'none', cursor: 'pointer', padding: '10px 12px',
          textAlign: 'left', color: '#E8DCC0',
        }}
      >
        {header}
        <span style={{ fontSize: 11, color: '#8A7A5C', marginLeft: 8, flexShrink: 0 }}>{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div style={{ padding: '0 12px 12px', borderTop: '1px solid rgba(232,160,32,0.08)' }}>
          {children}
        </div>
      )}
    </div>
  )
}

'use client'
import { useState } from 'react'

interface Props {
  imageUrl: string
  onUpload: (url: string) => void
}

async function compressToJpeg(file: File): Promise<{ blob: Blob; originalKb: number; compressedKb: number }> {
  const originalKb = Math.round(file.size / 1024)
  return new Promise(resolve => {
    const img = new Image()
    const objectUrl = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(objectUrl)
      const MAX = 800
      let w = img.width
      let h = img.height
      if (w > MAX && w >= h) { h = Math.round(h * MAX / w); w = MAX }
      else if (h > MAX && h > w) { w = Math.round(w * MAX / h); h = MAX }
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      canvas.getContext('2d')!.drawImage(img, 0, 0, w, h)
      canvas.toBlob(blob => {
        if (!blob) { resolve({ blob: new Blob([file]), originalKb, compressedKb: originalKb }); return }
        resolve({ blob, originalKb, compressedKb: Math.round(blob.size / 1024) })
      }, 'image/jpeg', 0.82)
    }
    img.src = objectUrl
  })
}

export default function ImageUpload({ imageUrl, onUpload }: Props) {
  const [uploading, setUploading] = useState(false)
  const [sizes, setSizes] = useState<{ original: number; compressed: number } | null>(null)

  const handleFile = async (file: File) => {
    setUploading(true)
    setSizes(null)
    try {
      const { blob, originalKb, compressedKb } = await compressToJpeg(file)
      setSizes({ original: originalKb, compressed: compressedKb })
      const formData = new FormData()
      formData.append('file', new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' }))
      formData.append('bucket', 'products')
      const res = await fetch('/api/upload-image', { method: 'POST', body: formData })
      const json = await res.json()
      if (json.error) alert('Upload error : ' + json.error)
      else onUpload(json.url)
    } catch (e: unknown) {
      alert('Upload error : ' + (e instanceof Error ? e.message : e))
    }
    setUploading(false)
  }

  return (
    <div>
      {imageUrl && (
        <img src={imageUrl} alt="preview" style={{ width: '100%', height: 160, objectFit: 'cover', borderRadius: 10, marginBottom: 10 }} />
      )}
      <label style={{ display: 'block', padding: '18px 14px', borderRadius: 10, border: '1.5px dashed #E8A020', background: 'rgba(232,160,32,0.04)', color: '#E8A020', cursor: uploading ? 'default' : 'pointer', textAlign: 'center', fontSize: 13, fontWeight: 600, fontFamily: 'DM Sans, sans-serif', opacity: uploading ? 0.7 : 1, transition: 'opacity 0.2s' }}>
        {uploading ? 'Upload...' : 'Choisir une image'}
        <input type="file" accept="image/*" style={{ display: 'none' }} disabled={uploading} onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]) }} />
      </label>
      {sizes && (
        <div style={{ marginTop: 6, display: 'flex', gap: 16, fontSize: 11, fontFamily: 'DM Sans, sans-serif', color: '#C8B99A' }}>
          <span>Original : <strong style={{ color: '#F5EDD6' }}>{sizes.original} Ko</strong></span>
          <span>Compressé : <strong style={{ color: '#E8A020' }}>{sizes.compressed} Ko</strong></span>
        </div>
      )}
    </div>
  )
}

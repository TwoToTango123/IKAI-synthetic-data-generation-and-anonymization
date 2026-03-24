import React, { useState } from 'react'
import FileUpload from '../components/FileUpload'
import { anonymizeData } from '../services/api'

function Anonymize() {
  const [file, setFile] = useState(null)
  const [loading, setLoading] = useState(false)

  const handleFileUpload = (uploadedFile) => {
    setFile(uploadedFile)
  }

  const handleAnonymize = async () => {
    if (!file) return

    setLoading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const blob = await anonymizeData(formData)

      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `anon_${file.name}`
      document.body.appendChild(link)
      link.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(link)
    } catch (err) {
      console.error('Anonymize API error:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container">
      <h1 className="section-title">Анонимизация данных</h1>

      {!file && <FileUpload onFileUpload={handleFileUpload} />}

      {file && (
        <div className="file-info">
          <span>Файл: {file.name}</span>
          <button
            className="btn btn-secondary btn-small"
            onClick={() => setFile(null)}
          >
            Загрузить другой
          </button>
        </div>
      )}

      <button
        className="btn btn-success btn-large btn-block"
        onClick={handleAnonymize}
        disabled={!file || loading}
      >
        {loading ? 'Обрабатываю...' : 'Применить'}
      </button>
    </div>
  )
}

export default Anonymize

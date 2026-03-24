import React, { useState } from 'react'
import FileUpload from '../components/FileUpload'
import { anonymizeData } from '../services/api'

function Anonymize() {
  const [file, setFile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleFileUpload = (uploadedFile) => {
    setFile(uploadedFile)
    setError('')
  }

  const handleAnonymize = async () => {
    if (!file) {
      setError('Пожалуйста, загрузите CSV файл')
      return
    }

    setError('')
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
      const message = err?.message || 'Не удалось обработать файл'
      setError(`Ошибка API: ${message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container">
      <h1 className="section-title">Анонимизация данных</h1>

      {error && (
        <div className="alert alert-error">
          <span className="alert-icon">!</span>
          <div>{error}</div>
        </div>
      )}

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

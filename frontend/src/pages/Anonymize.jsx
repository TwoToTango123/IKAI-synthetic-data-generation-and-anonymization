import React, { useState } from 'react'
import FileUpload from '../components/FileUpload'

function Anonymize() {
  const [file, setFile] = useState(null)

  const handleFileUpload = (uploadedFile) => {
    setFile(uploadedFile)
  }

  const handleAnonymize = () => {
    console.log('Anonymize clicked:', { fileName: file?.name || null })
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
        disabled={!file}
      >
        Применить
      </button>
    </div>
  )
}

export default Anonymize

import React, { useState } from 'react'

function Anonymize() {
  const [file, setFile] = useState(null)

  const handleAnonymize = () => {
    console.log('Anonymize clicked:', { fileName: file?.name || null })
  }

  return (
    <div className="container">
      <h1 className="section-title">Анонимизация данных</h1>

      <div className="form-group">
        <label className="form-label">Загрузите CSV файл:</label>
        <input
          type="file"
          className="form-input"
          accept=".csv"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
        />
      </div>

      <button
        className="btn btn-success btn-large btn-block"
        onClick={handleAnonymize}
      >
        Применить
      </button>
    </div>
  )
}

export default Anonymize

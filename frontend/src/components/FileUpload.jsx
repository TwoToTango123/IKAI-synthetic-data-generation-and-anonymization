import React, { useState } from 'react'

function FileUpload({ onFileUpload, onError }) {
  const [isDragActive, setIsDragActive] = useState(false)

  const validateFile = (file) => {
    if (file.type === 'text/csv' || file.type === 'text/plain' || file.name.toLowerCase().endsWith('.csv')) {
      onFileUpload(file)
      return
    }

    onError?.('Загрузите файл в формате CSV. Например: users.csv или orders.csv.')
  }

  const handleDrag = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setIsDragActive(true)
    } else if (e.type === 'dragleave') {
      setIsDragActive(false)
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragActive(false)

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateFile(e.dataTransfer.files[0])
    }
  }

  const handleChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      validateFile(e.target.files[0])
    }
  }

  return (
    <div
      className={`file-upload-area ${isDragActive ? 'active' : ''}`}
      onDragEnter={handleDrag}
      onDragLeave={handleDrag}
      onDragOver={handleDrag}
      onDrop={handleDrop}
      onClick={() => document.getElementById('file-input').click()}
    >
      <div className="file-upload-icon">CSV</div>
      <div className="file-upload-text">Перетащите CSV файл сюда</div>
      <div className="file-upload-hint">или нажмите, чтобы выбрать файл</div>
      <input
        id="file-input"
        type="file"
        accept=".csv"
        onChange={handleChange}
      />
    </div>
  )
}

export default FileUpload

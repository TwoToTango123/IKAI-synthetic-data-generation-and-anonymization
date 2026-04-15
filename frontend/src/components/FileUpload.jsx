import React, { useState } from 'react'

function FileUpload({ onFileUpload }) {
  const [isDragActive, setIsDragActive] = useState(false)

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
      const file = e.dataTransfer.files[0]
      if (file.type === 'text/csv' || file.type === 'text/plain' || file.name.endsWith('.csv')) {
        onFileUpload(file)
      } else {
        alert('Пожалуйста, загрузите CSV файл')
      }
    }
  }

  const handleChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0]
      if (file.type === 'text/csv' || file.type === 'text/plain' || file.name.endsWith('.csv')) {
        onFileUpload(file)
      } else {
        alert('Пожалуйста, загрузите CSV файл')
      }
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

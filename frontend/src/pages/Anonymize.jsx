import React, { useEffect, useRef, useState } from 'react'
import FileUpload from '../components/FileUpload'
import { anonymizeData, getCsvHeaders } from '../services/api'
import { parseCsvPreview } from '../utils/csvPreview'
import Box from '../components/Box'
import '../styles/Home.css'
import StatusModal from '../components/StatusModal'
import '../styles/GenScreen.css'

const TEMPLATE_COLUMNS = {
  users: ['full_name', 'email', 'phone', 'city'],
  orders: ['user_id', 'date', 'amount'],
}

const DEFAULT_SELECTION = {
  users: ['full_name', 'email', 'phone', 'city'],
  orders: ['user_id', 'date', 'amount'],
}

const COLUMN_TYPES = {
  users: {
    full_name: 'name',
    email: 'email',
    phone: 'phone',
    city: 'city',
  },
  orders: {
    user_id: 'digits',
    date: 'date',
    amount: 'numeric',
  },
}

const ANONYMIZATION_METHODS = {
  MASKING: 'masking',
  PSEUDONYMIZATION: 'pseudonymization',
  REMOVE: 'remove',
}

const PREVIEW_ROW_LIMIT = 5

function Anonymize({ setActiveTab }) {
  const [template, setTemplate] = useState('users')
  const [selectedColumns, setSelectedColumns] = useState(DEFAULT_SELECTION.users)
  const [file, setFile] = useState(null)
  const [method, setMethod] = useState(ANONYMIZATION_METHODS.MASKING)
  const [removeMode, setRemoveMode] = useState('empty')
  const [pseudonymSalt, setPseudonymSalt] = useState('')
  const [csvHeaders, setCsvHeaders] = useState([])
  const [loading, setLoading] = useState(false)
  const [inputPreview, setInputPreview] = useState(null)
  const [outputPreview, setOutputPreview] = useState(null)
  const [notification, setNotification] = useState(null)
  const [fieldErrors, setFieldErrors] = useState({})
  const notificationTimerRef = useRef(null)

  useEffect(() => {
    return () => {
      if (notificationTimerRef.current) {
        window.clearTimeout(notificationTimerRef.current)
      }
    }
  }, [])

  const showNotification = (type, message) => {
    setNotification({ type, message })
    if (notificationTimerRef.current) {
      window.clearTimeout(notificationTimerRef.current)
    }
    notificationTimerRef.current = window.setTimeout(() => {
      setNotification(null)
    }, 3500)
  }

  const clearFieldError = (fieldName) => {
    setFieldErrors((prev) => {
      if (!prev[fieldName]) {
        return prev
      }
      const nextErrors = { ...prev }
      delete nextErrors[fieldName]
      return nextErrors
    })
  }

  const columns = TEMPLATE_COLUMNS[template] || []

  const handleTemplateChange = (event) => {
    const nextTemplate = event.target.value
    setTemplate(nextTemplate)
    setSelectedColumns(DEFAULT_SELECTION[nextTemplate] || [])
    setOutputPreview(null)
    setFieldErrors({})
  }

  const handleMethodChange = (event) => {
    const nextMethod = event.target.value
    setMethod(nextMethod)
    if (nextMethod === ANONYMIZATION_METHODS.MASKING) {
      setSelectedColumns(DEFAULT_SELECTION[template] || [])
    } else if (csvHeaders.length > 0) {
      setSelectedColumns(csvHeaders)
    } else {
      setSelectedColumns([])
    }
    setOutputPreview(null)
    setFieldErrors({})
  }

  const toggleColumn = (column) => {
    clearFieldError('columns')
    setSelectedColumns((prev) => {
      if (prev.includes(column)) {
        return prev.filter((item) => item !== column)
      }
      return [...prev, column]
    })
  }

  const handleFileUpload = async (uploadedFile) => {
    setFile(uploadedFile)
    setOutputPreview(null)
    clearFieldError('file')
    clearFieldError('columns')

    try {
      const sourceText = await uploadedFile.text()
      const parsedInputPreview = parseCsvPreview(sourceText, PREVIEW_ROW_LIMIT)
      setInputPreview({
        fileName: uploadedFile.name,
        headers: parsedInputPreview.headers,
        rows: parsedInputPreview.rows,
      })

      const headers = await getCsvHeaders(uploadedFile)
      setCsvHeaders(headers)
      if (method !== ANONYMIZATION_METHODS.MASKING) {
        setSelectedColumns(headers)
      }
      showNotification('success', `Файл ${uploadedFile.name} загружен`)
    } catch (err) {
      setCsvHeaders([])
      const message = err?.message || 'Не удалось прочитать заголовки CSV'
      showNotification('error', `Ошибка API: ${message}`)
    }
  }

  const handleAnonymize = async () => {
    const nextErrors = {}
    if (!file) {
      nextErrors.file = 'Пожалуйста, загрузите CSV файл'
    }
    if (selectedColumns.length === 0) {
      nextErrors.columns = 'Выберите хотя бы одну колонку для анонимизации'
    }

    setFieldErrors(nextErrors)
    const firstError = Object.values(nextErrors)[0]
    if (firstError) {
      showNotification('error', firstError)
      return
    }

    setLoading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('method', method)

      if (method === ANONYMIZATION_METHODS.MASKING) {
        const columnTypes = COLUMN_TYPES[template] || {}
        const emailColumns = selectedColumns.filter((col) => columnTypes[col] === 'email')
        const phoneColumns = selectedColumns.filter((col) => columnTypes[col] === 'phone')
        const nameColumns = selectedColumns.filter((col) => columnTypes[col] === 'name')
        const cityColumns = selectedColumns.filter((col) => columnTypes[col] === 'city')
        const digitsColumns = selectedColumns.filter((col) => columnTypes[col] === 'digits')
        const dateColumns = selectedColumns.filter((col) => columnTypes[col] === 'date')
        const numericColumns = selectedColumns.filter((col) => columnTypes[col] === 'numeric')

        if (emailColumns.length > 0) {
          formData.append('email_columns', emailColumns.join(','))
        }
        if (phoneColumns.length > 0) {
          formData.append('phone_columns', phoneColumns.join(','))
        }
        if (nameColumns.length > 0) {
          formData.append('name_columns', nameColumns.join(','))
        }
        if (cityColumns.length > 0) {
          formData.append('city_columns', cityColumns.join(','))
        }
        if (digitsColumns.length > 0) {
          formData.append('digits_columns', digitsColumns.join(','))
        }
        if (dateColumns.length > 0) {
          formData.append('date_columns', dateColumns.join(','))
        }
        if (numericColumns.length > 0) {
          formData.append('numeric_columns', numericColumns.join(','))
        }
      } else {
        formData.append('target_columns', selectedColumns.join(','))
        if (method === ANONYMIZATION_METHODS.PSEUDONYMIZATION && pseudonymSalt.trim()) {
          formData.append('pseudonym_salt', pseudonymSalt.trim())
        }
        if (method === ANONYMIZATION_METHODS.REMOVE) {
          formData.append('remove_mode', removeMode)
        }
      }

      const blob = await anonymizeData(formData)

      const resultText = await blob.text()
      const parsedOutputPreview = parseCsvPreview(resultText, PREVIEW_ROW_LIMIT)
      setOutputPreview({
        fileName: `anon_${file.name}`,
        headers: parsedOutputPreview.headers,
        rows: parsedOutputPreview.rows,
      })

      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `anon_${file.name}`
      document.body.appendChild(link)
      link.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(link)
      showNotification('success', 'Файл анонимизирован и готов к скачиванию')
    } catch (err) {
      const message = err?.message || 'Не удалось обработать файл'
      showNotification('error', `Ошибка API: ${message}`)
    } finally {
      setLoading(false)
    }
  }

  const renderPreviewTable = (preview) => {
    if (!preview || preview.headers.length === 0 || preview.rows.length === 0) {
      return <div className="preview-empty">Нет данных для предпросмотра.</div>
    }

    return (
      <div className="table-preview preview-table" style={{ background: 'white', border: 'none' }}>
        <table>
          <thead>
            <tr>
              {preview.headers.map((header) => (
                <th key={header}>{header || '—'}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {preview.rows.map((row, rowIndex) => (
              <tr key={`${preview.fileName}-${rowIndex}`}>
                {preview.headers.map((_, cellIndex) => (
                  <td key={`${preview.fileName}-${rowIndex}-${cellIndex}`}>
                    {row[cellIndex] || '—'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  return (
    <div className="frame gen-screen">
      <div className="rectangle" />
      <p
        className="datagen-tool"
        onClick={() => setActiveTab('home')}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            setActiveTab('home')
          }
        }}
        role="button"
        tabIndex={0}
      >
        <span className="text-wrapper">DataGen</span>
        <span className="span">&nbsp;</span>
        <span className="text-wrapper-2">Tool</span>
      </p>
      <button className="div" onClick={() => setActiveTab('generate')}>
        Генерация
      </button>
      <button className="text-wrapper-3" onClick={() => setActiveTab('anonymize')}>
        Анонимизация
      </button>
      <div
        className="brand-icon"
        onClick={() => setActiveTab('home')}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            setActiveTab('home')
          }
        }}
        role="button"
        tabIndex={0}
      >
        <Box />
      </div>

      <div className="footer-copyright">® IKAI 2026</div>

      <StatusModal
        open={Boolean(notification)}
        type={notification?.type || 'info'}
        title={notification?.type === 'success' ? 'Готово' : 'Ошибка'}
        message={notification?.message || ''}
        onClose={() => setNotification(null)}
      />

      <div className="main-form-card" style={{ height: 'auto', minHeight: '601px', paddingBottom: '40px' }}>
        <h1 className="main-title">Анонимизация данных</h1>

        <div className="field-grid">
          <div className={`field-group${fieldErrors.file ? ' error' : ''}`} style={{ gridColumn: 'span 2' }}>
            <label className="field-label">Загрузка файла:</label>
            {!file ? (
              <FileUpload onFileUpload={handleFileUpload} error={Boolean(fieldErrors.file)} />
            ) : (
              <div className="file-info" style={{ background: 'rgba(217,217,217,0.3)', border: 'none' }}>
                <span className="checkbox-label" style={{ fontWeight: 400 }}>Файл: {file.name}</span>
                <button
                  className="small-btn"
                  onClick={() => {
                    setFile(null)
                    clearFieldError('file')
                  }}
                >
                  Загрузить другой
                </button>
              </div>
            )}
            {fieldErrors.file && <div className="field-error">{fieldErrors.file}</div>}
          </div>

          <div className="field-group">
            <label className="field-label">Способ анонимизации:</label>
            <div className="input-container">
              <select className="form-select" value={method} onChange={handleMethodChange}>
                <option value={ANONYMIZATION_METHODS.MASKING}>Маскирование</option>
                <option value={ANONYMIZATION_METHODS.PSEUDONYMIZATION}>Псевдонимизация</option>
                <option value={ANONYMIZATION_METHODS.REMOVE}>Удаление/замена на пустое</option>
              </select>
            </div>
          </div>

          <div className="field-group">
            <label className="field-label">Шаблон колонок:</label>
            <div className="input-container">
              <select
                className="form-select"
                value={template}
                onChange={handleTemplateChange}
                disabled={method !== ANONYMIZATION_METHODS.MASKING}
              >
                <option value="users">users</option>
                <option value="orders">orders</option>
              </select>
            </div>
          </div>

          {method === ANONYMIZATION_METHODS.PSEUDONYMIZATION && (
            <div className="field-group" style={{ gridColumn: 'span 2' }}>
              <label className="field-label">Секретный ключ (необязательно):</label>
              <div className="input-container">
                <input
                  type="text"
                  className="form-input"
                  value={pseudonymSalt}
                  onChange={(e) => setPseudonymSalt(e.target.value)}
                  placeholder="Например: project-2026-secret"
                />
              </div>
            </div>
          )}

          {method === ANONYMIZATION_METHODS.REMOVE && (
            <div className="field-group" style={{ gridColumn: 'span 2' }}>
              <label className="field-label">Что делать с выбранными колонками:</label>
              <div className="input-container">
                <select className="form-select" value={removeMode} onChange={(e) => setRemoveMode(e.target.value)}>
                  <option value="empty">Оставить колонку, но очистить значения</option>
                  <option value="drop">Удалить колонку полностью</option>
                </select>
              </div>
            </div>
          )}

          <div className={`field-group${fieldErrors.columns ? ' error' : ''}`} style={{ gridColumn: 'span 2' }}>
            <label className="field-label">Колонки для анонимизации:</label>
            <div className="checkbox-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
              {(method === ANONYMIZATION_METHODS.MASKING ? columns : csvHeaders).map((column) => (
                <label className="custom-checkbox" key={column}>
                  <input
                    type="checkbox"
                    checked={selectedColumns.includes(column)}
                    onChange={() => toggleColumn(column)}
                  />
                  <div className="checkbox-box">
                    <div className="checkbox-inner" />
                  </div>
                  <span className="checkbox-label">{column}</span>
                </label>
              ))}
              {(method === ANONYMIZATION_METHODS.MASKING ? columns : csvHeaders).length === 0 && (
                <span className="phone-prefix-hint">Загрузите файл или выберите шаблон</span>
              )}
            </div>
            {fieldErrors.columns && <div className="field-error">{fieldErrors.columns}</div>}
          </div>
        </div>

        <button
          className="submit-btn"
          onClick={handleAnonymize}
          disabled={!file || loading}
          aria-busy={loading}
        >
          <span className="button-content">
            {loading && <span className="loading button-spinner" aria-hidden="true" />}
            <span>{loading ? 'Обрабатываю...' : 'Применить'}</span>
          </span>
        </button>

        {loading && (
          <div className="loading-bar" aria-hidden="true">
            <span />
          </div>
        )}
      </div>

      {(inputPreview || outputPreview) && (
        <div className="preview-container" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          <div className="preview-card">
            <h2 className="main-title" style={{ fontSize: '18px', marginBottom: '10px', textAlign: 'left' }}>До обработки</h2>
            {inputPreview ? renderPreviewTable(inputPreview) : <div className="preview-empty">Файл не загружен.</div>}
          </div>
          <div className="preview-card">
            <h2 className="main-title" style={{ fontSize: '18px', marginBottom: '10px', textAlign: 'left' }}>После обработки</h2>
            {outputPreview ? renderPreviewTable(outputPreview) : <div className="preview-empty">Результат появится после обработки.</div>}
          </div>
        </div>
      )}
    </div>
  )
}

export default Anonymize

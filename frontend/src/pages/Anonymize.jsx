import React, { useEffect, useRef, useState } from 'react'
import FileUpload from '../components/FileUpload'
import { anonymizeData, deanonymizeData, getCsvHeaders } from '../services/api'

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

// Storage keys for client-side mapping
const MAPPINGS_STORAGE_KEY = 'ikai_pseudonym_mappings_v2'
const MAPPING_EXPIRY_DAYS = 30 // Delete mappings after 30 days

function Anonymize() {
  const [template, setTemplate] = useState('users')
  const [selectedColumns, setSelectedColumns] = useState(DEFAULT_SELECTION.users)
  const [file, setFile] = useState(null)
  const [method, setMethod] = useState(ANONYMIZATION_METHODS.MASKING)
  const [removeMode, setRemoveMode] = useState('empty')
  const [pseudonymSalt, setPseudonymSalt] = useState('')
  const [csvHeaders, setCsvHeaders] = useState([])
  const [latestMappingId, setLatestMappingId] = useState('')
  const [savedMappings, setSavedMappings] = useState([])
  const [restoreFile, setRestoreFile] = useState(null)
  const [selectedMappingId, setSelectedMappingId] = useState('')
  const [restoring, setRestoring] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const errorRef = useRef(null)

  const columns = TEMPLATE_COLUMNS[template] || []

  // Clean up expired mappings on component mount
  useEffect(() => {
    cleanupExpiredMappings()
    loadSavedMappings()
  }, [])

  useEffect(() => {
    if (error && errorRef.current) {
      errorRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
      errorRef.current.focus()
    }
  }, [error])

  const cleanupExpiredMappings = () => {
    try {
      const raw = window.localStorage.getItem(MAPPINGS_STORAGE_KEY)
      if (!raw) return

      const mappings = JSON.parse(raw)
      const now = new Date().getTime()
      const expiryMs = MAPPING_EXPIRY_DAYS * 24 * 60 * 60 * 1000

      const validMappings = mappings.filter((item) => {
        const createdAt = new Date(item.createdAt).getTime()
        const age = now - createdAt
        return age < expiryMs
      })

      if (validMappings.length !== mappings.length) {
        window.localStorage.setItem(MAPPINGS_STORAGE_KEY, JSON.stringify(validMappings))
      }
    } catch (err) {
      console.error('Error cleaning up expired mappings:', err)
    }
  }

  const loadSavedMappings = () => {
    try {
      const raw = window.localStorage.getItem(MAPPINGS_STORAGE_KEY)
      if (!raw) {
        setSavedMappings([])
        return
      }
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) {
        setSavedMappings(parsed)
      }
    } catch {
      setSavedMappings([])
    }
  }

  const saveMappingToBrowser = (mappingData) => {
    if (!mappingData || typeof mappingData !== 'object') {
      console.error('Invalid mapping data')
      return null
    }

    try {
      const mappingId = `m_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      const normalizedMapping = mappingData.columns ? mappingData : {
        columns: mappingData,
        created_at: new Date().toISOString(),
        version: '1.0',
      }
      const entry = {
        id: mappingId,
        mapping: normalizedMapping,
        createdAt: new Date().toISOString(),
        sourceFile: file?.name || '',
        expiresAt: new Date(Date.now() + MAPPING_EXPIRY_DAYS * 24 * 60 * 60 * 1000).toISOString(),
      }

      const withoutDuplicate = savedMappings.filter((item) => item.id !== mappingId)
      const next = [entry, ...withoutDuplicate].slice(0, 20)
      setSavedMappings(next)
      window.localStorage.setItem(MAPPINGS_STORAGE_KEY, JSON.stringify(next))
      setLatestMappingId(mappingId)
      setSelectedMappingId(mappingId)
      return mappingId
    } catch (err) {
      console.error('Error saving mapping:', err)
      setError('Не удалось сохранить mapping в браузер')
      return null
    }
  }

  const removeSavedMapping = (mappingId) => {
    const next = savedMappings.filter((item) => item.id !== mappingId)
    setSavedMappings(next)
    window.localStorage.setItem(MAPPINGS_STORAGE_KEY, JSON.stringify(next))
    if (selectedMappingId === mappingId) {
      setSelectedMappingId('')
    }
  }

  const getTimeUntilExpiry = (expiresAt) => {
    const now = new Date().getTime()
    const expiry = new Date(expiresAt).getTime()
    const diff = expiry - now

    if (diff <= 0) return 'истекло'

    const days = Math.floor(diff / (24 * 60 * 60 * 1000))
    const hours = Math.floor((diff % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000))

    if (days > 0) return `${days} дн. ${hours} ч.`
    return `${hours} ч.`
  }

  const handleTemplateChange = (event) => {
    const nextTemplate = event.target.value
    setTemplate(nextTemplate)
    setSelectedColumns(DEFAULT_SELECTION[nextTemplate] || [])
    setError('')
  }

  const handleMethodChange = (event) => {
    const nextMethod = event.target.value
    setMethod(nextMethod)
    setLatestMappingId('')
    if (nextMethod === ANONYMIZATION_METHODS.MASKING) {
      setSelectedColumns(DEFAULT_SELECTION[template] || [])
    } else if (csvHeaders.length > 0) {
      setSelectedColumns(csvHeaders)
    } else {
      setSelectedColumns([])
    }
    setError('')
  }

  const toggleColumn = (column) => {
    setSelectedColumns((prev) => {
      if (prev.includes(column)) {
        return prev.filter((item) => item !== column)
      }
      return [...prev, column]
    })
  }

  const handleFileUpload = async (uploadedFile) => {
    setFile(uploadedFile)
    setError('')

    try {
      const headers = await getCsvHeaders(uploadedFile)
      setCsvHeaders(headers)
      if (method !== ANONYMIZATION_METHODS.MASKING) {
        setSelectedColumns(headers)
      }
    } catch (err) {
      setCsvHeaders([])
      const message = err?.message || 'Не удалось прочитать заголовки CSV'
      setError(message)
    }
  }

  const handleAnonymize = async () => {
    if (!file) {
      setError('Загрузите CSV-файл для обработки')
      return
    }

    if (selectedColumns.length === 0) {
      setError('Выберите хотя бы одну колонку для обработки')
      return
    }

    setError('')
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

      const { blob, data } = await anonymizeData(formData)
      
      if (method === ANONYMIZATION_METHODS.PSEUDONYMIZATION && data && data.mapping) {
        // Save the full mapping (not just ID) for client-side storage
        saveMappingToBrowser(data.mapping)
      }

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
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  const handleRestore = async () => {
    if (!restoreFile) {
      setError('Загрузите CSV с псевдонимами для восстановления')
      return
    }

    if (!selectedMappingId.trim()) {
      setError('Выберите mapping из сохраненных')
      return
    }

    // Find the selected mapping in local storage
    const selectedMapping = savedMappings.find((item) => item.id === selectedMappingId)
    if (!selectedMapping || !selectedMapping.mapping) {
      setError('Mapping не найден или истек')
      return
    }

    const mappingPayload = selectedMapping.mapping.columns
      ? selectedMapping.mapping
      : {
          columns: selectedMapping.mapping,
          created_at: new Date().toISOString(),
          version: '1.0',
        }

    setError('')
    setRestoring(true)
    try {
      const formData = new FormData()
      formData.append('file', restoreFile)
      // Send the full mapping as JSON string instead of just mapping_id
      formData.append('mapping', JSON.stringify(mappingPayload))
      
      const blob = await deanonymizeData(formData)

      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `restored_${restoreFile.name}`
      document.body.appendChild(link)
      link.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(link)
    } catch (err) {
      const message = err?.message || 'Не удалось восстановить файл'
      setError(message)
    } finally {
      setRestoring(false)
    }
  }

  return (
    <div className="container">
      <h1 className="section-title">Анонимизация данных</h1>

      {error && (
        <div className="alert alert-error" ref={errorRef} tabIndex="-1" role="alert">
          <span className="alert-icon">!</span>
          <div>{error}</div>
        </div>
      )}

      {!file && <FileUpload onFileUpload={handleFileUpload} onError={setError} />}

      <div className="form-group">
        <label className="form-label">Способ анонимизации:</label>
        <select className="form-select" value={method} onChange={handleMethodChange}>
          <option value={ANONYMIZATION_METHODS.MASKING}>Маскирование</option>
          <option value={ANONYMIZATION_METHODS.PSEUDONYMIZATION}>Псевдонимизация</option>
          <option value={ANONYMIZATION_METHODS.REMOVE}>Удаление/замена на пустое</option>
        </select>
        <div className="alert alert-info" style={{ marginTop: '0.75rem' }}>
          <span className="alert-icon">i</span>
          <div>
            {method === ANONYMIZATION_METHODS.MASKING && 'Маскирование: частично скрывает значения по типу колонки (email/телефон/дата и т.д.).'}
            {method === ANONYMIZATION_METHODS.PSEUDONYMIZATION && 'Псевдонимизация: заменяет исходные значения на стабильные псевдонимы (одинаковые значения -> одинаковый псевдоним).'}
            {method === ANONYMIZATION_METHODS.REMOVE && 'Удаление/замена на пустое: выберите отдельные колонки из файла, затем очистите их значения или удалите полностью.'}
          </div>
        </div>
      </div>

      {method === ANONYMIZATION_METHODS.PSEUDONYMIZATION && (
        <>
          <div className="form-group">
            <label className="form-label">Секретный ключ для псевдонимизации (необязательно):</label>
            <input
              type="text"
              className="form-input"
              value={pseudonymSalt}
              onChange={(e) => setPseudonymSalt(e.target.value)}
              placeholder="Например: project-2026-secret"
            />
            <div className="form-help" style={{ marginTop: '0.5rem' }}>
              Один и тот же ключ дает одинаковые псевдонимы для одинаковых значений. Можно оставить пустым.
            </div>
          </div>

          {latestMappingId && (
            <div className="alert alert-success">
              <span className="alert-icon">✓</span>
              <div>
                Псевдонимизация завершена. mapping_id сохранен в браузере для обратного восстановления:<br />
                <strong>{latestMappingId}</strong>
              </div>
            </div>
          )}

          {savedMappings.length > 0 && (
            <div className="card" style={{ marginTop: '1rem' }}>
              <div className="card-title">Сохраненные псевдонимы в браузере (удаляются через {MAPPING_EXPIRY_DAYS} дней)</div>
              <div className="table-preview" style={{ margin: '0' }}>
                <table>
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Файл</th>
                      <th>Создано</th>
                      <th>Удалится через</th>
                      <th>Действия</th>
                    </tr>
                  </thead>
                  <tbody>
                    {savedMappings.map((item) => (
                      <tr key={item.id} style={{ backgroundColor: selectedMappingId === item.id ? '#f0f8ff' : 'transparent' }}>
                        <td><code style={{ fontSize: '0.8em' }}>{item.id.substring(0, 12)}...</code></td>
                        <td>{item.sourceFile || '-'}</td>
                        <td>{new Date(item.createdAt).toLocaleString('ru-RU')}</td>
                        <td>{item.expiresAt ? getTimeUntilExpiry(item.expiresAt) : '-'}</td>
                        <td>
                          <div className="button-group">
                            <button
                              type="button"
                              className={`btn ${selectedMappingId === item.id ? 'btn-primary' : 'btn-secondary'} btn-small`}
                              onClick={() => setSelectedMappingId(item.id)}
                            >
                              {selectedMappingId === item.id ? '✓ Выбран' : 'Выбрать'}
                            </button>
                            <button
                              type="button"
                              className="btn btn-danger btn-small"
                              onClick={() => removeSavedMapping(item.id)}
                            >
                              Удалить
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="card" style={{ marginTop: '1.5rem' }}>
            <div className="card-title">Восстановление исходных данных</div>
            <div className="form-group">
              <label className="form-label">CSV с псевдонимами:</label>
              <input
                type="file"
                accept=".csv,text/csv"
                className="form-input"
                onChange={(event) => {
                  const nextFile = event.target.files?.[0] || null
                  setRestoreFile(nextFile)
                }}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Выбрать псевдонимы для восстановления:</label>
              {savedMappings.length === 0 ? (
                <p style={{ color: '#999', marginTop: '0.5rem' }}>
                  Нет сохраненных псевдонимов. Сначала выполните псевдонимизацию.
                </p>
              ) : (
                <select
                  className="form-select"
                  value={selectedMappingId}
                  onChange={(event) => setSelectedMappingId(event.target.value)}
                >
                  <option value="">-- Выберите псевдонимы --</option>
                  {savedMappings.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.sourceFile || 'Без названия'} - {new Date(item.createdAt).toLocaleString('ru-RU')} (удалится через {getTimeUntilExpiry(item.expiresAt)})
                    </option>
                  ))}
                </select>
              )}
            </div>

            <button
              className="btn btn-primary"
              onClick={handleRestore}
              disabled={restoring}
            >
              {restoring ? 'Восстанавливаю...' : 'Восстановить исходный CSV'}
            </button>
          </div>
        </>
      )}

      <div className="form-group">
        <label className="form-label">Шаблон для выбора колонок:</label>
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

      {method === ANONYMIZATION_METHODS.MASKING && (
        <div className="alert alert-info" style={{ marginBottom: '1rem' }}>
          <span className="alert-icon">i</span>
          <div>
            <div><strong>Требования к CSV для маскирования:</strong></div>
            <div>1. Первая строка должна содержать заголовки колонок.</div>
            <div>2. Названия колонок должны точно совпадать с шаблоном.</div>
            <div>3. Файл должен быть в формате CSV (UTF-8 или Windows-1251).</div>
            {template === 'users' ? (
              <>
                <div>Ожидаемые колонки users: full_name, email, phone, city.</div>
                <div>Формат данных: email вида name@domain, phone строка с цифрами и/или символами.</div>
              </>
            ) : (
              <>
                <div>Ожидаемые колонки orders: order_id, user_id, date, amount, status.</div>
                <div>Формат данных: date желательно YYYY-MM-DD, amount числовое значение.</div>
              </>
            )}
          </div>
        </div>
      )}

      {method === ANONYMIZATION_METHODS.REMOVE && (
        <div className="form-group">
          <label className="form-label">Что делать с выбранными колонками:</label>
          <select className="form-select" value={removeMode} onChange={(e) => setRemoveMode(e.target.value)}>
            <option value="empty">Оставить колонку, но очистить значения</option>
            <option value="drop">Удалить колонку полностью</option>
          </select>
        </div>
      )}

      <div className="form-group">
        <label className="form-label">Колонки для анонимизации:</label>
        {method !== ANONYMIZATION_METHODS.MASKING && !file ? (
          <div className="alert alert-info">
            <span className="alert-icon">i</span>
            <div>Загрузите CSV, чтобы увидеть список колонок файла</div>
          </div>
        ) : method !== ANONYMIZATION_METHODS.MASKING && csvHeaders.length === 0 ? (
          <div className="alert alert-info">
            <span className="alert-icon">i</span>
            <div>Не удалось прочитать заголовок CSV</div>
          </div>
        ) : (method === ANONYMIZATION_METHODS.MASKING ? columns : csvHeaders).length === 0 ? (
          <div className="alert alert-info">
            <span className="alert-icon">i</span>
            <div>Нет колонок для анонимизации в этом шаблоне</div>
          </div>
        ) : (
          <div className="checkbox-group">
            {(method === ANONYMIZATION_METHODS.MASKING ? columns : csvHeaders).map((column) => (
              <div className="checkbox-item" key={column}>
                <input
                  id={`col-${column}`}
                  type="checkbox"
                  checked={selectedColumns.includes(column)}
                  onChange={() => toggleColumn(column)}
                />
                <label htmlFor={`col-${column}`}>{column}</label>
              </div>
            ))}
          </div>
        )}
      </div>

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

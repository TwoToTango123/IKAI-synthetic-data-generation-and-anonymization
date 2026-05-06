import React, { useEffect, useRef, useState } from 'react'
import { generateData } from '../services/api'
import { parseCsvPreview } from '../utils/csvPreview'
import Box from '../components/Box'
import '../styles/Home.css'
import StatusModal from '../components/StatusModal'
import '../styles/GenScreen.css'

const ALLOWED_DOMAINS = ['gmail.com', 'rambler.ru', 'mail.ru', 'yandex.ru', 'microsoft.com']
const ORDER_STATUS_OPTIONS = ['new', 'paid', 'processing', 'completed', 'cancelled']
const COUNTRY_CODE_OPTIONS = [
  { value: '1', label: '+1 (US/CA)' },
  { value: '7', label: '+7 (RU/KZ)' },
  { value: '20', label: '+20 (EG)' },
  { value: '27', label: '+27 (ZA)' },
  { value: '30', label: '+30 (GR)' },
  { value: '33', label: '+33 (FR)' },
  { value: '34', label: '+34 (ES)' },
  { value: '39', label: '+39 (IT)' },
  { value: '44', label: '+44 (UK)' },
  { value: '49', label: '+49 (DE)' },
  { value: '52', label: '+52 (MX)' },
  { value: '54', label: '+54 (AR)' },
  { value: '55', label: '+55 (BR)' },
  { value: '61', label: '+61 (AU)' },
  { value: '62', label: '+62 (ID)' },
  { value: '63', label: '+63 (PH)' },
  { value: '64', label: '+64 (NZ)' },
  { value: '65', label: '+65 (SG)' },
  { value: '66', label: '+66 (TH)' },
  { value: '82', label: '+82 (KR)' },
  { value: '81', label: '+81 (JP)' },
  { value: '86', label: '+86 (CN)' },
  { value: '90', label: '+90 (TR)' },
  { value: '91', label: '+91 (IN)' },
  { value: '92', label: '+92 (PK)' },
  { value: '98', label: '+98 (IR)' },
  { value: '212', label: '+212 (MA)' },
  { value: '234', label: '+234 (NG)' },
  { value: '351', label: '+351 (PT)' },
  { value: '358', label: '+358 (FI)' },
  { value: '380', label: '+380 (UA)' },
  { value: '420', label: '+420 (CZ)' },
  { value: '972', label: '+972 (IL)' },
  { value: '971', label: '+971 (AE)' },
]

const PREVIEW_ROW_LIMIT = 5

function Generate({ setActiveTab }) {
  const [template, setTemplate] = useState('users')
  const [rows, setRows] = useState(1000)
  const [selectedDomains, setSelectedDomains] = useState(ALLOWED_DOMAINS)
  const [registrationMode, setRegistrationMode] = useState('any')
  const [registeredFrom, setRegisteredFrom] = useState('')
  const [registeredTo, setRegisteredTo] = useState('')
  const [selectedCountryCodes, setSelectedCountryCodes] = useState(['7'])
  const [phonePrefix, setPhonePrefix] = useState('')
  const [orderDateMode, setOrderDateMode] = useState('any')
  const [orderDateFrom, setOrderDateFrom] = useState('')
  const [orderDateTo, setOrderDateTo] = useState('')
  const [amountMode, setAmountMode] = useState('any')
  const [amountMin, setAmountMin] = useState('')
  const [amountMax, setAmountMax] = useState('')
  const [selectedStatuses, setSelectedStatuses] = useState(ORDER_STATUS_OPTIONS)
  const [loading, setLoading] = useState(false)
  const [preview, setPreview] = useState(null)
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

  const validateForm = () => {
    const nextErrors = {}

    if (!rows || Number.isNaN(Number(rows)) || Number(rows) <= 0) {
      nextErrors.rows = 'Укажите корректное количество строк'
    }

    if (template === 'users') {
      if (selectedDomains.length === 0) {
        nextErrors.selectedDomains = 'Выберите хотя бы один домен электронной почты'
      }
      if (phonePrefix && !/^\d{1,3}$/.test(phonePrefix)) {
        nextErrors.phonePrefix = 'Префикс телефона должен содержать от 1 до 3 цифр'
      }
      if (selectedCountryCodes.length === 0) {
        nextErrors.selectedCountryCodes = 'Выберите хотя бы один код страны'
      }
      if (registrationMode === 'range' && (!registeredFrom || !registeredTo)) {
        nextErrors.registration = 'Выберите обе даты регистрации'
      }
      if (registrationMode === 'range' && registeredFrom && registeredTo && registeredFrom > registeredTo) {
        nextErrors.registration = 'Дата "с" не может быть больше даты "по"'
      }
    }

    if (template === 'orders') {
      if (selectedStatuses.length === 0) {
        nextErrors.selectedStatuses = 'Выберите хотя бы один статус'
      }
      if (orderDateMode === 'range' && (!orderDateFrom || !orderDateTo)) {
        nextErrors.orderDate = 'Выберите обе даты заказа'
      }
      if (orderDateMode === 'range' && orderDateFrom && orderDateTo && orderDateFrom > orderDateTo) {
        nextErrors.orderDate = 'Дата заказа "с" не может быть больше даты "по"'
      }
      if (amountMode === 'range' && (amountMin === '' || amountMax === '')) {
        nextErrors.amount = 'Укажите минимальную и максимальную сумму'
      }
      if (amountMode === 'range') {
        const min = Number(amountMin)
        const max = Number(amountMax)
        if (Number.isNaN(min) || Number.isNaN(max)) {
          nextErrors.amount = 'Диапазон суммы должен содержать числа'
        } else if (min < 0) {
          nextErrors.amount = 'Минимальная сумма не может быть отрицательной'
        } else if (max <= 0) {
          nextErrors.amount = 'Максимальная сумма должна быть больше 0'
        } else if (min > max) {
          nextErrors.amount = 'Минимальная сумма не может быть больше максимальной'
        }
      }
    }

    return nextErrors
  }

  const toggleDomain = (domain) => {
    clearFieldError('selectedDomains')
    setSelectedDomains((prev) => {
      if (prev.includes(domain)) {
        return prev.filter((item) => item !== domain)
      }
      return [...prev, domain]
    })
  }

  const toggleCountryCode = (code) => {
    clearFieldError('selectedCountryCodes')
    setSelectedCountryCodes((prev) => {
      if (prev.includes(code)) {
        return prev.filter((item) => item !== code)
      }
      return [...prev, code]
    })
  }

  const selectAllCountryCodes = () => {
    clearFieldError('selectedCountryCodes')
    setSelectedCountryCodes(COUNTRY_CODE_OPTIONS.map((option) => option.value))
  }

  const clearAllCountryCodes = () => {
    clearFieldError('selectedCountryCodes')
    setSelectedCountryCodes([])
  }

  const toggleStatus = (status) => {
    clearFieldError('selectedStatuses')
    setSelectedStatuses((prev) => {
      if (prev.includes(status)) {
        return prev.filter((item) => item !== status)
      }
      return [...prev, status]
    })
  }

  const handleGenerateClick = async () => {
    const nextErrors = validateForm()
    setFieldErrors(nextErrors)
    const firstError = Object.values(nextErrors)[0]
    if (firstError) {
      showNotification('error', firstError)
      return
    }

    setLoading(true)
    try {
      const blob = await generateData({
        template,
        rows: parseInt(rows, 10),
        countryCodes: template === 'users' ? selectedCountryCodes.join(',') : undefined,
        phonePrefix: template === 'users' && phonePrefix ? phonePrefix : undefined,
        emailDomains: template === 'users' ? selectedDomains.join(',') : undefined,
        registeredFrom: template === 'users' && registrationMode === 'range' ? registeredFrom : undefined,
        registeredTo: template === 'users' && registrationMode === 'range' ? registeredTo : undefined,
        orderDateFrom: template === 'orders' && orderDateMode === 'range' ? orderDateFrom : undefined,
        orderDateTo: template === 'orders' && orderDateMode === 'range' ? orderDateTo : undefined,
        amountMin: template === 'orders' && amountMode === 'range' ? amountMin : undefined,
        amountMax: template === 'orders' && amountMode === 'range' ? amountMax : undefined,
        statuses: template === 'orders' ? selectedStatuses.join(',') : undefined,
      })

      const previewText = await blob.text()
      const parsedPreview = parseCsvPreview(previewText, PREVIEW_ROW_LIMIT)
      setPreview({
        fileName: `${template}.csv`,
        headers: parsedPreview.headers,
        rows: parsedPreview.rows,
      })

      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${template}.csv`
      document.body.appendChild(link)
      link.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(link)
      showNotification('success', 'Файл сгенерирован и готов к скачиванию')
    } catch (err) {
      const message = err?.message || 'Не удалось сгенерировать данные'
      showNotification('error', `Ошибка API: ${message}`)
    } finally {
      setLoading(false)
    }
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

      <div className="main-form-card">
        <h1 className="main-title">Генерация данных</h1>

        <div className="field-grid">
          {/* Row 1 */}
          <div className="field-group">
            <label className="field-label">Шаблон:</label>
            <div className="input-container">
              <select
                className="form-select"
                value={template}
                onChange={(e) => {
                  setTemplate(e.target.value)
                  setFieldErrors({})
                }}
              >
                <option value="users">Пользователи (users.csv)</option>
                <option value="orders">Заказы (orders.csv)</option>
              </select>
            </div>
          </div>

          <div className="field-group">
            <label className="field-label">Количество строк:</label>
            <div className={`input-container${fieldErrors.rows ? ' error' : ''}`}>
              <input
                type="number"
                className="form-input"
                value={rows}
                onChange={(e) => {
                  setRows(e.target.value)
                  clearFieldError('rows')
                }}
              />
            </div>
            {fieldErrors.rows && <div className="field-error">{fieldErrors.rows}</div>}
          </div>

          {/* Template Specific Rows */}
          {template === 'users' ? (
            <>
              {/* Users Row 2: Domains */}
              <div className={`field-group${fieldErrors.selectedDomains ? ' error' : ''}`} style={{ gridColumn: 'span 2' }}>
                <label className="field-label">Домены email:</label>
                <div className="checkbox-grid" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
                  {ALLOWED_DOMAINS.map((domain) => (
                    <label className="custom-checkbox" key={domain}>
                      <input
                        type="checkbox"
                        checked={selectedDomains.includes(domain)}
                        onChange={() => toggleDomain(domain)}
                      />
                      <div className="checkbox-box">
                        <div className="checkbox-inner" />
                      </div>
                      <span className="checkbox-label">{domain}</span>
                    </label>
                  ))}
                </div>
                {fieldErrors.selectedDomains && <div className="field-error">{fieldErrors.selectedDomains}</div>}
              </div>

              {/* Users Row 3: Country Codes */}
              <div className={`field-group${fieldErrors.selectedCountryCodes ? ' error' : ''}`} style={{ gridColumn: 'span 2' }}>
                <div style={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'center', gap: '20px', marginBottom: '10px' }}>
                  <label className="field-label" style={{ marginBottom: 0 }}>Коды страны:</label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button className="small-btn" onClick={selectAllCountryCodes}>Выбрать все</button>
                    <button className="small-btn" onClick={clearAllCountryCodes}>Снять все</button>
                  </div>
                </div>
                <div className="checkbox-grid countries">
                  {COUNTRY_CODE_OPTIONS.map((option) => (
                    <label className="custom-checkbox" key={option.value}>
                      <input
                        type="checkbox"
                        checked={selectedCountryCodes.includes(option.value)}
                        onChange={() => toggleCountryCode(option.value)}
                      />
                      <div className="checkbox-box">
                        <div className="checkbox-inner" />
                      </div>
                      <span className="checkbox-label">{option.label}</span>
                    </label>
                  ))}
                </div>
                {fieldErrors.selectedCountryCodes && <div className="field-error">{fieldErrors.selectedCountryCodes}</div>}
              </div>

              {/* Users Row 4: Phone Prefix */}
              <div className={`field-group${fieldErrors.phonePrefix || fieldErrors.registration ? ' error' : ''}`} style={{ gridColumn: 'span 2' }}>
                <label className="field-label">Префикс телефона (1-3 цифры после выбранного кода страны, необязательно):</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                  <div className={`input-container${fieldErrors.phonePrefix ? ' error' : ''}`} style={{ width: '239px' }}>
                    <input
                      type="text"
                      className="form-input"
                      value={phonePrefix}
                      onChange={(e) => {
                        setPhonePrefix(e.target.value.replace(/\D/g, '').slice(0, 3))
                        clearFieldError('phonePrefix')
                      }}
                    />
                  </div>
                  <span className="phone-prefix-hint">Например: 916 (или оставьте пустым)</span>
                </div>
                {fieldErrors.phonePrefix && <div className="field-error">{fieldErrors.phonePrefix}</div>}
              </div>

              {/* Users Row 5: Registration Date */}
              <div className={`field-group${fieldErrors.registration ? ' error' : ''}`} style={{ gridColumn: 'span 2' }}>
                <label className="field-label">Дата регистрации:</label>
                <div className="radio-field-group">
                  <label className="custom-radio">
                    <input
                      type="radio"
                      checked={registrationMode === 'any'}
                      onChange={() => {
                        setRegistrationMode('any')
                        clearFieldError('registration')
                      }}
                    />
                    <div className="radio-circle">
                      <div className="radio-dot" />
                    </div>
                    <span className="checkbox-label">Любая</span>
                  </label>
                  <label className="custom-radio">
                    <input
                      type="radio"
                      checked={registrationMode === 'range'}
                      onChange={() => {
                        setRegistrationMode('range')
                        clearFieldError('registration')
                      }}
                    />
                    <div className="radio-circle">
                      <div className="radio-dot" />
                    </div>
                    <span className="checkbox-label">Диапазон (с даты по дату)</span>
                  </label>
                </div>
                {registrationMode === 'range' && (
                  <div className="range-row">
                    <div className="range-item date-range-item">
                      <span className="checkbox-label">с:</span>
                      <div className={`input-container${fieldErrors.registration ? ' error' : ''}`}>
                        <input
                          type="date"
                          className="form-input"
                          value={registeredFrom}
                          onChange={(e) => {
                            setRegisteredFrom(e.target.value)
                            clearFieldError('registration')
                          }}
                        />
                      </div>
                    </div>
                    <div className="range-item date-range-item">
                      <span className="checkbox-label">по:</span>
                      <div className={`input-container${fieldErrors.registration ? ' error' : ''}`}>
                        <input
                          type="date"
                          className="form-input"
                          value={registeredTo}
                          onChange={(e) => {
                            setRegisteredTo(e.target.value)
                            clearFieldError('registration')
                          }}
                        />
                      </div>
                    </div>
                  </div>
                )}
                {fieldErrors.registration && <div className="field-error">{fieldErrors.registration}</div>}
              </div>
            </>
          ) : (
            <>
              {/* Orders Row 2: Date */}
              <div className={`field-group${fieldErrors.orderDate ? ' error' : ''}`}>
                <label className="field-label">Дата заказа:</label>
                <div className="radio-field-group">
                  <label className="custom-radio">
                    <input
                      type="radio"
                      checked={orderDateMode === 'any'}
                      onChange={() => {
                        setOrderDateMode('any')
                        clearFieldError('orderDate')
                      }}
                    />
                    <div className="radio-circle">
                      <div className="radio-dot" />
                    </div>
                    <span className="checkbox-label">Любая</span>
                  </label>
                  <label className="custom-radio">
                    <input
                      type="radio"
                      checked={orderDateMode === 'range'}
                      onChange={() => {
                        setOrderDateMode('range')
                        clearFieldError('orderDate')
                      }}
                    />
                    <div className="radio-circle">
                      <div className="radio-dot" />
                    </div>
                    <span className="checkbox-label">Диапазон (с даты по дату)</span>
                  </label>
                </div>
                {orderDateMode === 'range' && (
                  <div className="range-row">
                    <div className="range-item date-range-item">
                      <span className="checkbox-label">с:</span>
                      <div className={`input-container${fieldErrors.orderDate ? ' error' : ''}`}>
                        <input
                          type="date"
                          className="form-input"
                          value={orderDateFrom}
                          onChange={(e) => {
                            setOrderDateFrom(e.target.value)
                            clearFieldError('orderDate')
                          }}
                        />
                      </div>
                    </div>
                    <div className="range-item date-range-item">
                      <span className="checkbox-label">по:</span>
                      <div className={`input-container${fieldErrors.orderDate ? ' error' : ''}`}>
                        <input
                          type="date"
                          className="form-input"
                          value={orderDateTo}
                          onChange={(e) => {
                            setOrderDateTo(e.target.value)
                            clearFieldError('orderDate')
                          }}
                        />
                      </div>
                    </div>
                  </div>
                )}
                {fieldErrors.orderDate && <div className="field-error">{fieldErrors.orderDate}</div>}
              </div>

              {/* Orders Row 2 Right: Amount */}
              <div className={`field-group${fieldErrors.amount ? ' error' : ''}`}>
                <label className="field-label">Сумма:</label>
                <div className="radio-field-group">
                  <label className="custom-radio">
                    <input
                      type="radio"
                      checked={amountMode === 'any'}
                      onChange={() => {
                        setAmountMode('any')
                        clearFieldError('amount')
                      }}
                    />
                    <div className="radio-circle">
                      <div className="radio-dot" />
                    </div>
                    <span className="checkbox-label">Любая</span>
                  </label>
                  <label className="custom-radio">
                    <input
                      type="radio"
                      checked={amountMode === 'range'}
                      onChange={() => {
                        setAmountMode('range')
                        clearFieldError('amount')
                      }}
                    />
                    <div className="radio-circle">
                      <div className="radio-dot" />
                    </div>
                    <span className="checkbox-label">Диапазон</span>
                  </label>
                </div>
                {amountMode === 'range' && (
                  <div className="range-row">
                    <div className="range-item">
                      <span className="checkbox-label">минимум:</span>
                      <div className={`input-container${fieldErrors.amount ? ' error' : ''}`}>
                        <input
                          type="number"
                          className="form-input"
                          value={amountMin}
                          onChange={(e) => {
                            setAmountMin(e.target.value)
                            clearFieldError('amount')
                          }}
                        />
                      </div>
                    </div>
                    <div className="range-item">
                      <span className="checkbox-label">максимум:</span>
                      <div className={`input-container${fieldErrors.amount ? ' error' : ''}`}>
                        <input
                          type="number"
                          className="form-input"
                          value={amountMax}
                          onChange={(e) => {
                            setAmountMax(e.target.value)
                            clearFieldError('amount')
                          }}
                        />
                      </div>
                    </div>
                  </div>
                )}
                {fieldErrors.amount && <div className="field-error">{fieldErrors.amount}</div>}
              </div>

              {/* Orders Row 3: Statuses */}
              <div className={`field-group${fieldErrors.selectedStatuses ? ' error' : ''}`} style={{ gridColumn: 'span 2' }}>
                <label className="field-label">Статусы:</label>
                <div className="checkbox-grid">
                  {ORDER_STATUS_OPTIONS.map((status) => (
                    <label className="custom-checkbox" key={status}>
                      <input
                        type="checkbox"
                        checked={selectedStatuses.includes(status)}
                        onChange={() => toggleStatus(status)}
                      />
                      <div className="checkbox-box">
                        <div className="checkbox-inner" />
                      </div>
                      <span className="checkbox-label">{status}</span>
                    </label>
                  ))}
                </div>
                {fieldErrors.selectedStatuses && <div className="field-error">{fieldErrors.selectedStatuses}</div>}
              </div>
            </>
          )}
        </div>

        <button
          className="submit-btn"
          onClick={handleGenerateClick}
          disabled={loading}
          aria-busy={loading}
        >
          <span className="button-content">
            {loading && <span className="loading button-spinner" aria-hidden="true" />}
            <span>{loading ? 'Генерирую...' : 'Сгенерировать'}</span>
          </span>
        </button>

        {loading && (
          <div className="loading-bar" aria-hidden="true">
            <span />
          </div>
        )}
      </div>

      {preview && (
        <div className="preview-container">
          <h2 className="main-title" style={{ fontSize: '20px', marginBottom: '15px' }}>Предпросмотр результата</h2>
          <p className="phone-prefix-hint" style={{ marginBottom: '15px' }}>
            Файл {preview.fileName}. Показаны первые {preview.rows.length} строк.
          </p>

          <div className="table-preview" style={{ background: 'white', borderRadius: '12px', border: 'none' }}>
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
                  <tr key={rowIndex}>
                    {preview.headers.map((_, cellIndex) => (
                      <td key={cellIndex}>{row[cellIndex] || '—'}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

export default Generate

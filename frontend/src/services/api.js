import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api'

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

const extractErrorMessage = async (error, fallbackMessage) => {
  const data = error?.response?.data

  if (data instanceof Blob) {
    try {
      const text = await data.text()
      const json = JSON.parse(text)
      return json?.detail || fallbackMessage
    } catch {
      return fallbackMessage
    }
  }

  if (typeof data === 'object' && data !== null) {
    return data.detail || data.message || fallbackMessage
  }

  if (typeof data === 'string' && data.trim()) {
    return data
  }

  return error?.message || fallbackMessage
}

// Генерация данных
export const generateData = async ({
  rows,
  template = 'users',
  countryCodes,
  phonePrefix,
  emailDomains,
  registeredFrom,
  registeredTo,
  orderDateFrom,
  orderDateTo,
  amountMin,
  amountMax,
  statuses,
}) => {
  try {
    const response = await api.get('/generate', {
      params: {
        rows,
        template,
        country_codes: countryCodes,
        phone_prefix: phonePrefix,
        email_domains: emailDomains,
        registered_from: registeredFrom,
        registered_to: registeredTo,
        order_date_from: orderDateFrom,
        order_date_to: orderDateTo,
        amount_min: amountMin,
        amount_max: amountMax,
        statuses,
      },
      responseType: 'blob',
    })
    return response.data
  } catch (error) {
    throw new Error(await extractErrorMessage(error, 'Не удалось сгенерировать данные'))
  }
}

// Анонимизация данных
export const anonymizeData = async (formData) => {
  try {
    const response = await api.post('/anonymize', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      responseType: 'blob',
    })
    return response.data
  } catch (error) {
    throw new Error(await extractErrorMessage(error, 'Не удалось анонимизировать данные'))
  }
}

export const getCsvHeaders = async (file) => {
  try {
    const formData = new FormData()
    formData.append('file', file)

    const response = await api.post('/csv-headers', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })

    return response.data?.headers || []
  } catch (error) {
    throw new Error(await extractErrorMessage(error, 'Не удалось прочитать заголовок CSV'))
  }
}

export default api

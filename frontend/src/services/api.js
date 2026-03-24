import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api'

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Генерация данных
export const generateData = async (payload) => {
  try {
    const response = await api.post('/generate', payload, {
      responseType: 'blob',
    })
    return response.data
  } catch (error) {
    throw error.response?.data || error.message
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
    throw error.response?.data || error.message
  }
}

// Получить предпросмотр загруженного CSV
export const getPreview = async (file) => {
  try {
    const formData = new FormData()
    formData.append('file', file)
    const response = await api.post('/preview', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
    return response.data
  } catch (error) {
    throw error.response?.data || error.message
  }
}

export default api

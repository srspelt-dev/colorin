import axios from 'axios';

const envApiUrl = import.meta.env.VITE_API_URL;
const isMancoDomain =
  typeof window !== 'undefined' && window.location.hostname.includes('manco.app');

const API_BASE_URL = isMancoDomain
  ? 'https://api-colorin.manco.app'
  : envApiUrl || 'http://localhost:8000';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor para agregar el token a las peticiones
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Interceptor para manejar errores de autenticación
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token inválido o expirado
      localStorage.removeItem('token');
      localStorage.removeItem('username');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  login: (username, password) => {
    const formData = new FormData();
    formData.append('username', username);
    formData.append('password', password);
    return apiClient.post('/login', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },
  me: () => apiClient.get('/usuarios/me'),
  cambiarPassword: (passwordActual, passwordNueva) =>
    apiClient.put('/usuarios/me/cambiar-password', {
      password_actual: passwordActual,
      password_nueva: passwordNueva,
    }),
  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
  },
};

// Profesores
export const profesoresAPI = {
  listar: (activo = null) => {
    const params = activo !== null ? { activo } : {};
    return apiClient.get('/profesores/', { params });
  },
  obtener: (id) => apiClient.get(`/profesores/${id}`),
  crear: (data) => apiClient.post('/profesores/', data),
  actualizar: (id, data) => apiClient.put(`/profesores/${id}`, data),
  eliminar: (id) => apiClient.delete(`/profesores/${id}`),
};

// Eventos
export const eventosAPI = {
  listar: (filtros = {}) => apiClient.get('/eventos/', { params: filtros }),
  obtener: (id) => apiClient.get(`/eventos/${id}`),
  crear: (data) => apiClient.post('/eventos/', data),
  actualizar: (id, data) => apiClient.put(`/eventos/${id}`, data),
  eliminar: (id) => apiClient.delete(`/eventos/${id}`),
  asignarAutomatico: (eventoId, cantidadProfes) =>
    apiClient.post(`/eventos/${eventoId}/asignar-automatico?cantidad_profes=${cantidadProfes}`),
};

// Asignaciones
export const asignacionesAPI = {
  listar: (filtros = {}) => apiClient.get('/asignaciones/', { params: filtros }),
  crear: (data) => apiClient.post('/asignaciones/', data),
  crearMultiples: (data) => apiClient.post('/asignaciones/multiples', data),
  eliminar: (id) => apiClient.delete(`/asignaciones/${id}`),
};

// Recomendaciones
export const recomendacionesAPI = {
  profesoresRecomendados: (eventoId) =>
    apiClient.get(`/eventos/${eventoId}/profesores-recomendados`),
};

// Reportes
export const reportesAPI = {
  estadisticasProfesores: (filtros = {}) =>
    apiClient.get('/reportes/estadisticas-profesores', { params: filtros }),
  eventosPorProfe: (profesorId, filtros = {}) =>
    apiClient.get(`/reportes/eventos-por-profe/${profesorId}`, { params: filtros }),
  distribucionEquitativa: () => apiClient.get('/reportes/distribucion-equitativa'),
};

// Tareas
export const tareasAPI = {
  listar: (filtros = {}) => apiClient.get('/tareas/', { params: filtros }),
  obtener: (id) => apiClient.get(`/tareas/${id}`),
  crear: (data) => apiClient.post('/tareas/', data),
  actualizar: (id, data) => apiClient.put(`/tareas/${id}`, data),
  eliminar: (id) => apiClient.delete(`/tareas/${id}`),
  toggle: (id) => apiClient.patch(`/tareas/${id}/toggle`),
};

// Tareas de Evento
export const tareasEventoAPI = {
  listar: (eventoId, filtros = {}) => apiClient.get(`/eventos/${eventoId}/tareas`, { params: filtros }),
  crear: (eventoId, data) => apiClient.post(`/eventos/${eventoId}/tareas`, data),
  actualizar: (eventoId, tareaId, data) => apiClient.put(`/eventos/${eventoId}/tareas/${tareaId}`, data),
  eliminar: (eventoId, tareaId) => apiClient.delete(`/eventos/${eventoId}/tareas/${tareaId}`),
  toggle: (eventoId, tareaId) => apiClient.patch(`/eventos/${eventoId}/tareas/${tareaId}/toggle`),
};

export default apiClient;

import { useEffect, useState } from 'react';
import { tareasAPI } from '../api/client';
import Loading from '../components/Loading';
import './Tareas.css';

export default function Tareas() {
  const [tareas, setTareas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [filtroCompletadas, setFiltroCompletadas] = useState(null);
  const [filtroPrioridad, setFiltroPrioridad] = useState('');
  const [formData, setFormData] = useState({
    titulo: '',
    descripcion: '',
    fecha_vencimiento: '',
    prioridad: 'media',
  });
  const [editingId, setEditingId] = useState(null);

  useEffect(() => {
    cargarTareas();
  }, [filtroCompletadas, filtroPrioridad]); // eslint-disable-line react-hooks/exhaustive-deps

  const cargarTareas = async () => {
    try {
      const filtros = {};
      if (filtroCompletadas !== null) {
        filtros.completada = filtroCompletadas;
      }
      if (filtroPrioridad) {
        filtros.prioridad = filtroPrioridad;
      }
      const response = await tareasAPI.listar(filtros);
      setTareas(response.data);
    } catch (error) {
      console.error('Error cargando tareas:', error);
      alert('Error al cargar tareas');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const data = {
        ...formData,
        fecha_vencimiento: formData.fecha_vencimiento || null,
      };
      if (editingId) {
        await tareasAPI.actualizar(editingId, data);
      } else {
        await tareasAPI.crear(data);
      }
      setShowForm(false);
      setFormData({
        titulo: '',
        descripcion: '',
        fecha_vencimiento: '',
        prioridad: 'media',
      });
      setEditingId(null);
      cargarTareas();
    } catch (error) {
      console.error('Error guardando tarea:', error);
      alert(error.response?.data?.detail || 'Error al guardar tarea');
    }
  };

  const handleToggle = async (tareaId) => {
    try {
      await tareasAPI.toggle(tareaId);
      cargarTareas();
    } catch (error) {
      console.error('Error cambiando estado de tarea:', error);
      alert('Error al cambiar el estado de la tarea');
    }
  };

  const handleEdit = (tarea) => {
    setFormData({
      titulo: tarea.titulo,
      descripcion: tarea.descripcion || '',
      fecha_vencimiento: tarea.fecha_vencimiento || '',
      prioridad: tarea.prioridad,
    });
    setEditingId(tarea.id);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Estás seguro de eliminar esta tarea?')) return;
    try {
      await tareasAPI.eliminar(id);
      cargarTareas();
    } catch (error) {
      console.error('Error eliminando tarea:', error);
      alert(error.response?.data?.detail || 'Error al eliminar tarea');
    }
  };

  if (loading) {
    return <Loading text="Cargando tareas..." size="large" />;
  }

  const tareasPendientes = tareas.filter((t) => !t.completada);
  const tareasCompletadas = tareas.filter((t) => t.completada);

  return (
    <div className="tareas-page">
      <div className="page-header">
        <h2>✅ Tareas</h2>
        <button
          className="btn btn-primary"
          onClick={() => {
            setShowForm(!showForm);
            setEditingId(null);
            setFormData({
              titulo: '',
              descripcion: '',
              fecha_vencimiento: '',
              prioridad: 'media',
            });
          }}
        >
          {showForm ? '❌ Cancelar' : '➕ Agregar Tarea'}
        </button>
      </div>

      {showForm && (
        <form className="form-card" onSubmit={handleSubmit}>
          <h3>{editingId ? 'Editar' : 'Nueva'} Tarea</h3>
          <div className="form-group">
            <label>Título:</label>
            <input
              type="text"
              value={formData.titulo}
              onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
              required
              placeholder="Ej: Preparar materiales para evento"
            />
          </div>
          <div className="form-group">
            <label>Descripción:</label>
            <textarea
              value={formData.descripcion}
              onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
              rows="3"
              placeholder="Detalles adicionales..."
            />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Fecha de Vencimiento:</label>
              <input
                type="date"
                value={formData.fecha_vencimiento}
                onChange={(e) => setFormData({ ...formData, fecha_vencimiento: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>Prioridad:</label>
              <select
                value={formData.prioridad}
                onChange={(e) => setFormData({ ...formData, prioridad: e.target.value })}
                required
              >
                <option value="baja">🟢 Baja</option>
                <option value="media">🟡 Media</option>
                <option value="alta">🔴 Alta</option>
              </select>
            </div>
          </div>
          <button type="submit" className="btn btn-primary">
            {editingId ? '💾 Guardar Cambios' : '➕ Crear Tarea'}
          </button>
        </form>
      )}

      <div className="filtros-card">
        <h3>Filtros</h3>
        <div className="filtros-grid">
          <div className="filtro-group">
            <label>Estado:</label>
            <div className="filtro-buttons">
              <button
                className={`filtro-btn ${filtroCompletadas === null ? 'active' : ''}`}
                onClick={() => setFiltroCompletadas(null)}
              >
                Todas
              </button>
              <button
                className={`filtro-btn ${filtroCompletadas === false ? 'active' : ''}`}
                onClick={() => setFiltroCompletadas(false)}
              >
                Pendientes
              </button>
              <button
                className={`filtro-btn ${filtroCompletadas === true ? 'active' : ''}`}
                onClick={() => setFiltroCompletadas(true)}
              >
                Completadas
              </button>
            </div>
          </div>
          <div className="filtro-group">
            <label>Prioridad:</label>
            <select
              value={filtroPrioridad}
              onChange={(e) => setFiltroPrioridad(e.target.value)}
            >
              <option value="">Todas</option>
              <option value="baja">🟢 Baja</option>
              <option value="media">🟡 Media</option>
              <option value="alta">🔴 Alta</option>
            </select>
          </div>
        </div>
      </div>

      <div className="stats-tareas">
        <div className="stat-item">
          <span className="stat-number">{tareasPendientes.length}</span>
          <span className="stat-label">Pendientes</span>
        </div>
        <div className="stat-item">
          <span className="stat-number">{tareasCompletadas.length}</span>
          <span className="stat-label">Completadas</span>
        </div>
        <div className="stat-item">
          <span className="stat-number">{tareas.length}</span>
          <span className="stat-label">Total</span>
        </div>
      </div>

      {tareasPendientes.length > 0 && (
        <div className="tareas-section">
          <h3>📋 Tareas Pendientes ({tareasPendientes.length})</h3>
          <div className="tareas-list">
            {tareasPendientes.map((tarea) => (
              <TareaCard
                key={tarea.id}
                tarea={tarea}
                onToggle={() => handleToggle(tarea.id)}
                onEdit={() => handleEdit(tarea)}
                onDelete={() => handleDelete(tarea.id)}
              />
            ))}
          </div>
        </div>
      )}

      {tareasCompletadas.length > 0 && (
        <div className="tareas-section">
          <h3>✅ Tareas Completadas ({tareasCompletadas.length})</h3>
          <div className="tareas-list">
            {tareasCompletadas.map((tarea) => (
              <TareaCard
                key={tarea.id}
                tarea={tarea}
                onToggle={() => handleToggle(tarea.id)}
                onEdit={() => handleEdit(tarea)}
                onDelete={() => handleDelete(tarea.id)}
              />
            ))}
          </div>
        </div>
      )}

      {tareas.length === 0 && (
        <div className="empty-state">
          <p>No hay tareas registradas.</p>
          <button className="btn btn-primary" onClick={() => setShowForm(true)}>
            ➕ Agregar Primera Tarea
          </button>
        </div>
      )}
    </div>
  );
}

function TareaCard({ tarea, onToggle, onEdit, onDelete }) {
  const formatearFecha = (fechaString) => {
    if (!fechaString) return '';
    // Si la fecha viene como string ISO (YYYY-MM-DD), formatearla directamente
    // sin pasar por Date para evitar problemas de zona horaria
    if (typeof fechaString === 'string' && fechaString.match(/^\d{4}-\d{2}-\d{2}$/)) {
      const [año, mes, dia] = fechaString.split('-');
      const fecha = new Date(parseInt(año), parseInt(mes) - 1, parseInt(dia));
      return fecha.toLocaleDateString('es-ES');
    }
    // Si es un objeto Date o otro formato, usar el método estándar
    const fecha = new Date(fechaString);
    // Crear fecha en zona horaria local para evitar el offset
    const año = fecha.getFullYear();
    const mes = fecha.getMonth();
    const dia = fecha.getDate();
    const fechaLocal = new Date(año, mes, dia);
    return fechaLocal.toLocaleDateString('es-ES');
  };

  // Verificar si la tarea está vencida usando fechas locales
  const estaVencida = (() => {
    if (!tarea.fecha_vencimiento || tarea.completada) return false;
    
    // Crear fecha de vencimiento en zona horaria local
    let fechaVencimiento;
    if (typeof tarea.fecha_vencimiento === 'string' && tarea.fecha_vencimiento.match(/^\d{4}-\d{2}-\d{2}$/)) {
      const [año, mes, dia] = tarea.fecha_vencimiento.split('-');
      fechaVencimiento = new Date(parseInt(año), parseInt(mes) - 1, parseInt(dia));
    } else {
      const fecha = new Date(tarea.fecha_vencimiento);
      fechaVencimiento = new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate());
    }
    
    // Crear fecha actual en zona horaria local (sin hora)
    const hoy = new Date();
    const hoyLocal = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
    
    return fechaVencimiento < hoyLocal;
  })();

  const prioridadConfig = {
    baja: { icon: '🟢', label: 'Baja', color: '#28a745' },
    media: { icon: '🟡', label: 'Media', color: '#ffc107' },
    alta: { icon: '🔴', label: 'Alta', color: '#dc3545' },
  };

  const prioridad = prioridadConfig[tarea.prioridad] || prioridadConfig.media;

  return (
    <div className={`tarea-card ${tarea.completada ? 'completada' : ''} ${estaVencida ? 'vencida' : ''}`}>
      <div className="tarea-header">
        <div className="tarea-checkbox-title">
          <input
            type="checkbox"
            checked={tarea.completada}
            onChange={onToggle}
            className="tarea-checkbox"
          />
          <h4 className={tarea.completada ? 'tachado' : ''}>{tarea.titulo}</h4>
        </div>
        <span className={`badge-prioridad prioridad-${tarea.prioridad}`}>
          {prioridad.icon} {prioridad.label}
        </span>
      </div>

      {tarea.descripcion && (
        <p className="tarea-descripcion">{tarea.descripcion}</p>
      )}

      <div className="tarea-meta">
        {tarea.fecha_vencimiento && (
          <span className={`tarea-fecha ${estaVencida ? 'vencida' : ''}`}>
            📅 {formatearFecha(tarea.fecha_vencimiento)}
            {estaVencida && ' ⚠️ Vencida'}
          </span>
        )}
        {tarea.completada && tarea.completada_en && (
          <span className="tarea-completada-en">
            ✅ Completada: {formatearFecha(tarea.completada_en)}
          </span>
        )}
      </div>

      <div className="tarea-actions">
        <button className="btn btn-sm btn-secondary" onClick={onEdit}>
          ✏️ Editar
        </button>
        <button className="btn btn-sm btn-danger" onClick={onDelete}>
          🗑️ Eliminar
        </button>
      </div>
    </div>
  );
}


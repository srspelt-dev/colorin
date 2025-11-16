import { useEffect, useState } from 'react';
import { profesoresAPI, asignacionesAPI, eventosAPI } from '../api/client';
import './Profesores.css';

export default function Profesores() {
  const [profesores, setProfesores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ nombre: '', activo: true });
  const [editingId, setEditingId] = useState(null);

  useEffect(() => {
    cargarProfesores();
  }, []);

  const cargarProfesores = async () => {
    try {
      const response = await profesoresAPI.listar();
      const profesoresList = response.data;
      
      // Cargar eventos para cada profesor
      const profesoresConEventos = await Promise.all(
        profesoresList.map(async (profesor) => {
          try {
            // Obtener asignaciones del profesor
            const asignacionesResponse = await asignacionesAPI.listar({ profesor_id: profesor.id });
            const asignaciones = asignacionesResponse.data;
            
            // Obtener datos de cada evento asignado
            const eventosAsignados = await Promise.all(
              asignaciones.map(async (asignacion) => {
                try {
                  const eventoResponse = await eventosAPI.obtener(asignacion.evento_id);
                  return {
                    id: eventoResponse.data.id,
                    nombre: eventoResponse.data.nombre,
                    fecha: eventoResponse.data.fecha,
                    tipo: eventoResponse.data.tipo,
                    ubicacion: eventoResponse.data.ubicacion,
                    asignacion_id: asignacion.id,
                    rol: asignacion.rol,
                  };
                } catch (error) {
                  console.error(`Error cargando evento ${asignacion.evento_id}:`, error);
                  return null;
                }
              })
            );
            
            return {
              ...profesor,
              eventosAsignados: eventosAsignados.filter(e => e !== null).sort((a, b) => new Date(a.fecha) - new Date(b.fecha))
            };
          } catch (error) {
            console.error(`Error cargando eventos del profesor ${profesor.id}:`, error);
            return { ...profesor, eventosAsignados: [] };
          }
        })
      );
      
      // Ordenar profesores alfabéticamente por nombre
      const profesoresOrdenados = profesoresConEventos.sort((a, b) => 
        a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' })
      );
      
      setProfesores(profesoresOrdenados);
    } catch (error) {
      console.error('Error cargando profesores:', error);
      alert('Error al cargar profesores');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingId) {
        await profesoresAPI.actualizar(editingId, formData);
      } else {
        await profesoresAPI.crear(formData);
      }
      setShowForm(false);
      setFormData({ nombre: '', activo: true });
      setEditingId(null);
      cargarProfesores();
    } catch (error) {
      console.error('Error guardando profesor:', error);
      alert(error.response?.data?.detail || 'Error al guardar profesor');
    }
  };

  const handleEdit = (profesor) => {
    setFormData({ nombre: profesor.nombre, activo: profesor.activo });
    setEditingId(profesor.id);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Estás seguro de eliminar este profesor?')) return;
    try {
      await profesoresAPI.eliminar(id);
      cargarProfesores();
    } catch (error) {
      console.error('Error eliminando profesor:', error);
      alert(error.response?.data?.detail || 'Error al eliminar profesor');
    }
  };

  if (loading) {
    return <div className="loading">Cargando profesores...</div>;
  }

  const totalProfesores = profesores.length;
  const profesoresActivos = profesores.filter(p => p.activo).length;
  const profesoresInactivos = profesores.filter(p => !p.activo).length;

  return (
    <div className="profesores-page">
      <div className="page-header">
        <h2>👥 Profesores</h2>
        <button
          className="btn btn-primary"
          onClick={() => {
            setShowForm(!showForm);
            setEditingId(null);
            setFormData({ nombre: '', activo: true });
          }}
        >
          {showForm ? '❌ Cancelar' : '➕ Agregar Profesor'}
        </button>
      </div>

      {/* Estadísticas de profesores */}
      <div className="profesores-stats-container">
        <div className="stat-card">
          <div className="stat-icon">👥</div>
          <div className="stat-content">
            <div className="stat-label">Total de Profesores</div>
            <div className="stat-number">{totalProfesores}</div>
          </div>
        </div>
        <div className="stat-card success">
          <div className="stat-icon">✅</div>
          <div className="stat-content">
            <div className="stat-label">Activos</div>
            <div className="stat-number">{profesoresActivos}</div>
          </div>
        </div>
        <div className="stat-card secondary">
          <div className="stat-icon">⏸️</div>
          <div className="stat-content">
            <div className="stat-label">Inactivos</div>
            <div className="stat-number">{profesoresInactivos}</div>
          </div>
        </div>
      </div>

      {showForm && (
        <form className="form-card" onSubmit={handleSubmit}>
          <h3>{editingId ? 'Editar' : 'Nuevo'} Profesor</h3>
          <div className="form-group">
            <label>Nombre:</label>
            <input
              type="text"
              value={formData.nombre}
              onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
              required
              placeholder="Ej: María González"
            />
          </div>
          <div className="form-group">
            <label>
              <input
                type="checkbox"
                checked={formData.activo}
                onChange={(e) => setFormData({ ...formData, activo: e.target.checked })}
              />
              {' '}Activo
            </label>
          </div>
          <button type="submit" className="btn btn-primary">
            {editingId ? '💾 Guardar Cambios' : '➕ Crear'}
          </button>
        </form>
      )}

      <div className="profesores-grid">
        {profesores.map((profesor) => (
          <div key={profesor.id} className={`profesor-card ${!profesor.activo ? 'inactivo' : ''}`}>
            <div className="profesor-header">
              <h3>{profesor.nombre}</h3>
              <span className={`badge ${profesor.activo ? 'badge-success' : 'badge-secondary'}`}>
                {profesor.activo ? '✓ Activo' : '✗ Inactivo'}
              </span>
            </div>
            <div className="profesor-stats">
              <div className="stat">
                <span className="stat-label">Eventos asignados:</span>
                <span className="stat-value">{profesor.eventosAsignados?.length || 0}</span>
              </div>
            </div>
            {profesor.eventosAsignados && profesor.eventosAsignados.length > 0 && (
              <div className="profesor-eventos">
                <strong className="eventos-titulo">📅 Eventos asignados:</strong>
                <div className="eventos-lista">
                  {profesor.eventosAsignados.map((evento) => {
                    // Formatear fecha correctamente (evitar problema de zona horaria)
                    const formatearFecha = (fechaString) => {
                      if (!fechaString) return '';
                      if (typeof fechaString === 'string' && fechaString.match(/^\d{4}-\d{2}-\d{2}$/)) {
                        const [año, mes, dia] = fechaString.split('-');
                        const fecha = new Date(parseInt(año), parseInt(mes) - 1, parseInt(dia));
                        return fecha.toLocaleDateString('es-ES', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric'
                        });
                      }
                      const fecha = new Date(fechaString);
                      const año = fecha.getFullYear();
                      const mes = fecha.getMonth();
                      const dia = fecha.getDate();
                      const fechaLocal = new Date(año, mes, dia);
                      return fechaLocal.toLocaleDateString('es-ES', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric'
                      });
                    };
                    
                    return (
                      <div key={evento.asignacion_id} className="evento-item">
                        <div className="evento-nombre-fecha">
                          <span className="evento-nombre">{evento.nombre}</span>
                          <span className="evento-fecha">{formatearFecha(evento.fecha)}</span>
                        </div>
                        {evento.ubicacion && (
                          <div className="evento-ubicacion">📍 {evento.ubicacion}</div>
                        )}
                        <div className="evento-tipo">🏷️ {evento.tipo}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            {(!profesor.eventosAsignados || profesor.eventosAsignados.length === 0) && (
              <div className="sin-eventos">
                <p>No tiene eventos asignados</p>
              </div>
            )}
            <div className="profesor-actions">
              <button
                className="btn btn-sm btn-secondary"
                onClick={() => handleEdit(profesor)}
              >
                ✏️ Editar
              </button>
              <button
                className="btn btn-sm btn-danger"
                onClick={() => handleDelete(profesor.id)}
              >
                🗑️ Eliminar
              </button>
            </div>
          </div>
        ))}
      </div>

      {profesores.length === 0 && (
        <div className="empty-state">
          <p>No hay profesores registrados.</p>
          <button className="btn btn-primary" onClick={() => setShowForm(true)}>
            ➕ Agregar Primer Profesor
          </button>
        </div>
      )}
    </div>
  );
}


import { useEffect, useState } from 'react';
import { reportesAPI, profesoresAPI } from '../api/client';
import Loading from '../components/Loading';
import jsPDF from 'jspdf';
import './Reportes.css';

export default function Reportes() {
  const [estadisticas, setEstadisticas] = useState([]);
  const [distribucion, setDistribucion] = useState(null);
  const [loading, setLoading] = useState(true);
  const [profesorSeleccionado, setProfesorSeleccionado] = useState(null);
  const [eventosProfe, setEventosProfe] = useState([]);
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');

  const cargarReportes = async () => {
    try {
      setLoading(true);
      const filtros = {};
      if (fechaDesde) filtros.fecha_desde = fechaDesde;
      if (fechaHasta) filtros.fecha_hasta = fechaHasta;
      
      const [statsRes, distRes] = await Promise.all([
        reportesAPI.estadisticasProfesores(filtros),
        reportesAPI.distribucionEquitativa(),
      ]);
      setEstadisticas(statsRes.data.estadisticas || []);
      setDistribucion(distRes.data);
    } catch (error) {
      console.error('Error cargando reportes:', error);
      alert('Error al cargar reportes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarReportes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Recargar reportes cuando cambien los filtros (con debounce)
  useEffect(() => {
    // No recargar en la carga inicial
    if (fechaDesde === '' && fechaHasta === '') return;
    
    const timer = setTimeout(() => {
      cargarReportes();
    }, 500); // Debounce de 500ms
    
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fechaDesde, fechaHasta]);

  const aplicarFiltroMes = (mesOffset = 0) => {
    const hoy = new Date();
    const año = hoy.getFullYear();
    const mes = hoy.getMonth() + mesOffset;
    
    // Primer día del mes
    const primerDia = new Date(año, mes, 1);
    // Último día del mes
    const ultimoDia = new Date(año, mes + 1, 0);
    
    setFechaDesde(primerDia.toISOString().split('T')[0]);
    setFechaHasta(ultimoDia.toISOString().split('T')[0]);
  };

  const limpiarFiltros = () => {
    setFechaDesde('');
    setFechaHasta('');
  };

  const verEventosProfe = async (profesorId) => {
    try {
      const filtros = {};
      if (fechaDesde) filtros.fecha_desde = fechaDesde;
      if (fechaHasta) filtros.fecha_hasta = fechaHasta;
      
      const response = await reportesAPI.eventosPorProfe(profesorId, filtros);
      setEventosProfe(response.data.eventos || []);
      setProfesorSeleccionado(response.data.profesor);
    } catch (error) {
      console.error('Error cargando eventos del profesor:', error);
      alert('Error al cargar eventos del profesor');
    }
  };

  // Recargar reportes cuando cambien los filtros (solo después de la carga inicial)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (fechaDesde || fechaHasta) {
        cargarReportes();
      }
    }, 300); // Debounce de 300ms
    
    return () => clearTimeout(timer);
  }, [fechaDesde, fechaHasta]);

  if (loading) {
    return <Loading text="Cargando reportes..." size="large" />;
  }

  return (
    <div className="reportes-page">
      <h2>📈 Reportes y Estadísticas</h2>

      {/* Filtros de fecha */}
      <div className="filtros-card">
        <h3>📅 Filtros por Fecha</h3>
        <div className="filtros-content">
          <div className="filtros-fechas">
            <div className="filtro-fecha-item">
              <label>Desde:</label>
              <input
                type="date"
                value={fechaDesde}
                onChange={(e) => setFechaDesde(e.target.value)}
              />
            </div>
            <div className="filtro-fecha-item">
              <label>Hasta:</label>
              <input
                type="date"
                value={fechaHasta}
                onChange={(e) => setFechaHasta(e.target.value)}
              />
            </div>
          </div>
          <div className="filtros-rapidos">
            <span className="filtros-label">Filtros rápidos:</span>
            <button
              className="btn btn-sm btn-secondary"
              onClick={() => aplicarFiltroMes(0)}
            >
              📅 Mes Actual
            </button>
            <button
              className="btn btn-sm btn-secondary"
              onClick={() => aplicarFiltroMes(-1)}
            >
              📅 Mes Anterior
            </button>
            <button
              className="btn btn-sm btn-secondary"
              onClick={() => aplicarFiltroMes(-2)}
            >
              📅 Hace 2 Meses
            </button>
            <button
              className="btn btn-sm btn-secondary"
              onClick={limpiarFiltros}
            >
              🗑️ Limpiar
            </button>
          </div>
          {(fechaDesde || fechaHasta) && (
            <div className="filtros-activos">
              <span className="filtro-activo-badge">
                {fechaDesde && `Desde: ${new Date(fechaDesde).toLocaleDateString('es-ES')}`}
                {fechaDesde && fechaHasta && ' | '}
                {fechaHasta && `Hasta: ${new Date(fechaHasta).toLocaleDateString('es-ES')}`}
              </span>
            </div>
          )}
        </div>
      </div>

      {distribucion && distribucion.analisis && (
        <div className="reporte-card distribucion-card">
          <h3>📊 Distribución Equitativa de Eventos</h3>
          <div className="analisis-grid">
            <div className="analisis-item">
              <span className="label">Mínimo de eventos:</span>
              <strong className="value">{distribucion.analisis.minimo_eventos}</strong>
            </div>
            <div className="analisis-item">
              <span className="label">Máximo de eventos:</span>
              <strong className="value">{distribucion.analisis.maximo_eventos}</strong>
            </div>
            <div className="analisis-item">
              <span className="label">Diferencia:</span>
              <strong className="value">{distribucion.analisis.diferencia}</strong>
            </div>
            <div className="analisis-item">
              <span className="label">Estado:</span>
              <strong
                className={`value ${distribucion.analisis.es_equitativo ? 'success' : 'warning'}`}
              >
                {distribucion.analisis.es_equitativo ? '✅ Equitativo' : '⚠️ Requiere ajuste'}
              </strong>
            </div>
          </div>
        </div>
      )}

      <div className="reporte-card">
        <h3>👥 Estadísticas por Profesor</h3>
        <div className="estadisticas-table">
          <div className="table-header">
            <div>Profesor</div>
            <div>Estado</div>
            <div>Eventos</div>
            <div>Acción</div>
          </div>
          {estadisticas.map((stat) => (
            <div key={stat.profesor_id} className="table-row">
              <div className="profesor-nombre">{stat.nombre}</div>
              <div>
                <span className={`badge ${stat.activo ? 'badge-success' : 'badge-secondary'}`}>
                  {stat.activo ? '✓ Activo' : '✗ Inactivo'}
                </span>
              </div>
              <div className="eventos-count">
                <strong>{stat.total_eventos}</strong>
              </div>
              <div>
                <button
                  className="btn btn-sm btn-primary"
                  onClick={() => verEventosProfe(stat.profesor_id)}
                >
                  👁️ Ver
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {estadisticas.length > 0 && (
        <div className="reporte-card resumen-card">
          <h3>📋 Resumen General</h3>
          <div className="resumen-grid">
            <div className="resumen-item">
              <span className="resumen-label">Total Profesores:</span>
              <span className="resumen-value">{estadisticas.length}</span>
            </div>
            <div className="resumen-item">
              <span className="resumen-label">Total Eventos Asignados:</span>
              <span className="resumen-value">
                {estadisticas.reduce((sum, stat) => sum + stat.total_eventos, 0)}
              </span>
            </div>
            <div className="resumen-item">
              <span className="resumen-label">Promedio por Profesor:</span>
              <span className="resumen-value">
                {estadisticas.length > 0
                  ? (
                      estadisticas.reduce((sum, stat) => sum + stat.total_eventos, 0) /
                      estadisticas.length
                    ).toFixed(2)
                  : 0}
              </span>
            </div>
          </div>
        </div>
      )}

      {profesorSeleccionado && (
        <div className="modal-overlay" onClick={() => setProfesorSeleccionado(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Eventos de {profesorSeleccionado.nombre}</h3>
              <button className="close-btn" onClick={() => setProfesorSeleccionado(null)}>
                ✕
              </button>
            </div>
            <div className="eventos-list-modal">
              {eventosProfe.length === 0 ? (
                <p className="empty-message">No hay eventos asignados.</p>
              ) : (
                eventosProfe.map((evento) => (
                  <div key={evento.evento_id} className="evento-item">
                    <div className="evento-item-header">
                      <strong>{evento.nombre}</strong>
                      <span className="evento-rol">{evento.rol}</span>
                    </div>
                    <div className="evento-item-details">
                      <span>📅 {new Date(evento.fecha).toLocaleDateString('es-ES')}</span>
                      {evento.ubicacion && <span>📍 {evento.ubicacion}</span>}
                      <span className="badge badge-primary">{evento.tipo}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


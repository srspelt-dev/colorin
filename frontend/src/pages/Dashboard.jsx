import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { profesoresAPI, eventosAPI, reportesAPI } from '../api/client';
import Loading from '../components/Loading';
import './Dashboard.css';

export default function Dashboard() {
  const [stats, setStats] = useState({
    totalProfesores: 0,
    totalEventos: 0,
    profesoresActivos: 0,
    distribucion: null,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    cargarEstadisticas();
  }, []);

  const cargarEstadisticas = async () => {
    try {
      const [profesRes, eventosRes, distribRes] = await Promise.all([
        profesoresAPI.listar(),
        eventosAPI.listar(),
        reportesAPI.distribucionEquitativa(),
      ]);

      const profesActivos = profesRes.data.filter((p) => p.activo).length;

      setStats({
        totalProfesores: profesRes.data.length,
        totalEventos: eventosRes.data.length,
        profesoresActivos: profesActivos,
        distribucion: distribRes.data,
      });
    } catch (error) {
      console.error('Error cargando estadísticas:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <Loading text="Cargando..." size="large" />;
  }

  return (
    <div className="dashboard">
      <h2>📊 Dashboard</h2>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon">👥</div>
          <div className="stat-content">
            <h3>{stats.totalProfesores}</h3>
            <p>Total Profesores</p>
            <small>{stats.profesoresActivos} activos</small>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">🎉</div>
          <div className="stat-content">
            <h3>{stats.totalEventos}</h3>
            <p>Total Eventos</p>
          </div>
        </div>
      </div>

      {stats.distribucion && stats.distribucion.distribucion?.length > 0 && (
        <div className="distribucion-card">
          <h3>📊 Distribución Equitativa</h3>
          {stats.distribucion.analisis && (
            <div className="analisis">
              <div className="analisis-item">
                <span>Mínimo:</span>
                <strong>{stats.distribucion.analisis.minimo_eventos}</strong>
              </div>
              <div className="analisis-item">
                <span>Máximo:</span>
                <strong>{stats.distribucion.analisis.maximo_eventos}</strong>
              </div>
              <div className="analisis-item">
                <span>Diferencia:</span>
                <strong>{stats.distribucion.analisis.diferencia}</strong>
              </div>
              <div className="analisis-item">
                <span>Estado:</span>
                <strong className={stats.distribucion.analisis.es_equitativo ? 'success' : 'warning'}>
                  {stats.distribucion.analisis.es_equitativo ? '✅ Equitativo' : '⚠️ Desequilibrado'}
                </strong>
              </div>
            </div>
          )}

          <div className="distribucion-list">
            {stats.distribucion.distribucion.slice(0, 5).map((prof) => (
              <div key={prof.profesor_id} className="distribucion-item">
                <span>{prof.nombre}</span>
                <strong>{prof.total_eventos_futuros} eventos</strong>
              </div>
            ))}
          </div>

          <Link to="/reportes" className="ver-mas-btn">
            Ver todos los reportes →
          </Link>
        </div>
      )}

      <div className="quick-actions">
        <h3>Acciones Rápidas</h3>
        <div className="actions-grid">
          <Link to="/profesores" className="action-btn">
            ➕ Agregar Profesor
          </Link>
          <Link to="/eventos" className="action-btn">
            ➕ Crear Evento
          </Link>
          <Link to="/reportes" className="action-btn">
            📈 Ver Reportes
          </Link>
        </div>
      </div>
    </div>
  );
}


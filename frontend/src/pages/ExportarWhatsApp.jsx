import { useState, useEffect } from 'react';
import { eventosAPI, profesoresAPI, authAPI, asignacionesAPI } from '../api/client';
import Loading from '../components/Loading';
import './ExportarWhatsApp.css';

export default function ExportarWhatsApp() {
  const [eventos, setEventos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [textoExportado, setTextoExportado] = useState('');
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    cargarUsuarioActual();
  }, []);

  useEffect(() => {
    if (fechaDesde && fechaHasta) {
      cargarEventos();
    }
  }, [fechaDesde, fechaHasta]);

  const cargarUsuarioActual = async () => {
    try {
      const response = await authAPI.me();
      setCurrentUser(response.data);
    } catch (error) {
      console.error('Error cargando usuario actual:', error);
    }
  };

  const cargarEventos = async () => {
    try {
      setLoading(true);
      const filtros = {};
      if (fechaDesde) filtros.fecha_desde = fechaDesde;
      if (fechaHasta) filtros.fecha_hasta = fechaHasta;

      const response = await eventosAPI.listar(filtros);
      const eventosList = response.data;

      // Cargar profesores asignados para cada evento
      const eventosConProfesores = await Promise.all(
        eventosList.map(async (evento) => {
          try {
            const asignacionesResponse = await asignacionesAPI.listar({ evento_id: evento.id });
            const asignaciones = asignacionesResponse.data || [];

            const profesoresData = await Promise.all(
              asignaciones.map(async (asignacion) => {
                try {
                  const profesorResponse = await profesoresAPI.obtener(asignacion.profesor_id);
                  return profesorResponse.data;
                } catch (error) {
                  console.error(`Error cargando profesor ${asignacion.profesor_id}:`, error);
                  return null;
                }
              })
            );

            return {
              ...evento,
              profesoresAsignados: profesoresData.filter(p => p !== null)
            };
          } catch (error) {
            console.error(`Error cargando asignaciones del evento ${evento.id}:`, error);
            return {
              ...evento,
              profesoresAsignados: []
            };
          }
        })
      );

      // Ordenar eventos por fecha y hora
      eventosConProfesores.sort((a, b) => {
        const fechaA = new Date(a.fecha);
        const fechaB = new Date(b.fecha);
        if (fechaA.getTime() !== fechaB.getTime()) {
          return fechaA.getTime() - fechaB.getTime();
        }
        // Si es la misma fecha, ordenar por horario
        const horaA = a.horario_cumpleanos || a.horario_colorin || '00:00';
        const horaB = b.horario_cumpleanos || b.horario_colorin || '00:00';
        return horaA.localeCompare(horaB);
      });

      setEventos(eventosConProfesores);
    } catch (error) {
      console.error('Error cargando eventos:', error);
      alert('Error al cargar eventos');
    } finally {
      setLoading(false);
    }
  };

  const formatearFecha = (fechaStr) => {
    const fecha = new Date(fechaStr);
    const diasSemana = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    
    const diaSemana = diasSemana[fecha.getDay()];
    const dia = fecha.getDate();
    const mes = fecha.getMonth() + 1;
    const año = fecha.getFullYear();
    
    return `${diaSemana} ${dia}/${mes}/${año}`;
  };

  const formatearFechaRango = () => {
    if (!fechaDesde || !fechaHasta) return '';
    
    const fechaInicio = new Date(fechaDesde);
    const fechaFin = new Date(fechaHasta);
    
    const diaInicio = fechaInicio.getDate();
    const mesInicio = fechaInicio.getMonth() + 1;
    const diaFin = fechaFin.getDate();
    const mesFin = fechaFin.getMonth() + 1;
    
    if (fechaInicio.getFullYear() === fechaFin.getFullYear() && 
        fechaInicio.getMonth() === fechaFin.getMonth()) {
      return `${diaInicio} al ${diaFin}`;
    } else {
      return `${diaInicio}/${mesInicio} al ${diaFin}/${mesFin}`;
    }
  };

  const extraerZona = (notas) => {
    if (!notas) return '';
    // Buscar "Zona:" en las notas
    const match = notas.match(/Zona:\s*([^\n]+)/i);
    return match ? match[1].trim() : '';
  };

  const extraerUbicacionURL = (notas) => {
    if (!notas) return '';
    // Buscar URLs de Google Maps
    const match = notas.match(/https?:\/\/[^\s]+/);
    return match ? match[0] : '';
  };

  const formatearHora = (hora) => {
    if (!hora) return '';
    return hora.includes(':') ? hora : `${hora.slice(0, 2)}:${hora.slice(2)}`;
  };

  const generarTextoWhatsApp = () => {
    if (eventos.length === 0) {
      setTextoExportado('No hay eventos para exportar en el rango de fechas seleccionado.');
      return;
    }

    let texto = `Eventos del ${formatearFechaRango()}\n\n`;

    eventos.forEach((evento, index) => {
      texto += `${evento.nombre}\n`;
      
      // Día
      texto += `•⁠  ⁠Día: ${formatearFecha(evento.fecha)}\n`;
      
      // Horarios
      if (evento.horario_colorin) {
        texto += `•⁠  ⁠Horario Colorín: ${formatearHora(evento.horario_colorin)}hs\n`;
      }
      if (evento.horario_cumpleanos) {
        texto += `•⁠  ⁠Horario Cumple: ${formatearHora(evento.horario_cumpleanos)}hs\n`;
      }
      
      // Lugar
      if (evento.ubicacion) {
        texto += `•⁠  ⁠Lugar: ${evento.ubicacion}\n`;
      }
      
      // Zona (extraer de notas)
      const zona = extraerZona(evento.notas);
      texto += `•⁠  ⁠Zona: ${zona ? ` ${zona}` : ''}\n`;
      
      // Ubicación (URL de Google Maps)
      const ubicacionURL = extraerUbicacionURL(evento.notas);
      texto += `•⁠  ⁠Ubicación: ${ubicacionURL}\n`;
      
      // Contacto (organizador)
      texto += `•⁠  ⁠Contacto${evento.organizador ? `: ${evento.organizador}` : ''}\n`;
      
      // Profesores
      if (evento.profesoresAsignados && evento.profesoresAsignados.length > 0) {
        const nombresProfes = evento.profesoresAsignados.map(p => p.nombre).join(' - ');
        texto += `•⁠  ⁠Profes: ${nombresProfes}\n`;
      } else {
        texto += `•⁠  ⁠Profes:\n`;
      }
      
      // Actividades
      if (evento.actividad && Array.isArray(evento.actividad) && evento.actividad.length > 0) {
        texto += `Actividades\n`;
        evento.actividad.forEach(act => {
          const actividadLimpia = act.startsWith('Otros: ') ? act.replace('Otros: ', '') : act;
          texto += `•⁠  ⁠${actividadLimpia}\n`;
        });
      }
      
      // Agregar línea en blanco entre eventos excepto el último
      if (index < eventos.length - 1) {
        texto += '\n';
      }
    });

    setTextoExportado(texto);
  };

  const copiarAlPortapapeles = async () => {
    try {
      await navigator.clipboard.writeText(textoExportado);
      alert('✅ Texto copiado al portapapeles');
    } catch (error) {
      console.error('Error copiando al portapapeles:', error);
      alert('Error al copiar al portapapeles');
    }
  };

  // Verificar si el usuario es admin
  if (!currentUser) {
    return <Loading text="Cargando..." />;
  }

  if (!currentUser.es_admin) {
    return (
      <div className="exportar-whatsapp-page">
        <div className="error-message">
          <h2>🔒 Acceso Restringido</h2>
          <p>Esta funcionalidad solo está disponible para administradores.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return <Loading text="Cargando eventos..." size="large" />;
  }

  return (
    <div className="exportar-whatsapp-page">
      <div className="page-header">
        <h2>📱 Exportar para WhatsApp</h2>
      </div>

      <div className="filtros-card">
        <h3>📅 Seleccionar Rango de Fechas</h3>
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
          <button 
            className="btn btn-primary" 
            onClick={cargarEventos}
            disabled={!fechaDesde || !fechaHasta}
          >
            🔍 Buscar Eventos
          </button>
        </div>
      </div>

      {eventos.length > 0 && (
        <div className="eventos-info">
          <p>📊 Se encontraron {eventos.length} evento(s) en el rango seleccionado</p>
          <button 
            className="btn btn-success" 
            onClick={generarTextoWhatsApp}
          >
            📝 Generar Texto para WhatsApp
          </button>
        </div>
      )}

      {textoExportado && (
        <div className="texto-exportado-card">
          <div className="texto-exportado-header">
            <h3>📋 Texto Generado</h3>
            <button 
              className="btn btn-primary btn-sm" 
              onClick={copiarAlPortapapeles}
            >
              📋 Copiar al Portapapeles
            </button>
          </div>
          <textarea 
            className="texto-exportado-textarea"
            value={textoExportado}
            readOnly
            rows={20}
            onClick={(e) => e.target.select()}
          />
          <div className="texto-exportado-info">
            <p>💡 Haz clic en el texto para seleccionarlo todo, o usa el botón "Copiar al Portapapeles"</p>
          </div>
        </div>
      )}

      {!fechaDesde || !fechaHasta ? (
        <div className="info-message">
          <p>👆 Selecciona un rango de fechas para comenzar</p>
        </div>
      ) : eventos.length === 0 && !loading ? (
        <div className="info-message">
          <p>📭 No se encontraron eventos en el rango de fechas seleccionado</p>
        </div>
      ) : null}
    </div>
  );
}


import { useEffect, useState } from 'react';
import { eventosAPI, asignacionesAPI, recomendacionesAPI, profesoresAPI, tareasEventoAPI } from '../api/client';
import Loading from '../components/Loading';
import jsPDF from 'jspdf';
import './Eventos.css';

export default function Eventos() {
  const [eventos, setEventos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const actividadesDisponibles = [
    'Slime',
    'Mini cheffs',
    'Tote bags',
    'Show de títeres',
    'Kids craft station',
    'Pulseras temáticas',
    'Kepis personalizados',
    'Alcancias para pintar',
    'Fábrica de peluches',
    'Lienzos para pintar',
    'Peluches Pintables',
    'Carita Pintada'
  ];

  const [formData, setFormData] = useState({
    nombre: '',
    fecha: '',
    tipo: 'cumpleaños',
    ubicacion: '',
    horario_colorin: '',
    horario_cumpleanos: '',
    actividad: [],
    notas: '',
    cantidad_profes: 1,
    mobiliario: '',
    organizador: '',
    cosas_entregadas: '',
  });
  const [actividadPersonalizada, setActividadPersonalizada] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [tareasEvento, setTareasEvento] = useState([]);
  const [cargandoTareas, setCargandoTareas] = useState(false);
  const [nuevaTareaDescripcion, setNuevaTareaDescripcion] = useState('');
  const [mostrarFormTarea, setMostrarFormTarea] = useState(false);
  const [tareasFormulario, setTareasFormulario] = useState([]); // Tareas temporales en el formulario
  const [nuevaTareaFormulario, setNuevaTareaFormulario] = useState(''); // Nueva tarea en el formulario
  const [cosasEntregadasLista, setCosasEntregadasLista] = useState([]); // Lista de cosas entregadas
  const [nuevaCosaEntregada, setNuevaCosaEntregada] = useState(''); // Nueva cosa entregada
  const [asignacionModal, setAsignacionModal] = useState(null);
  const [asignacionManualModal, setAsignacionManualModal] = useState(null);
  const [cantidadProfes, setCantidadProfes] = useState(1);
  const [profesoresRecomendados, setProfesoresRecomendados] = useState([]);
  const [profesoresSeleccionados, setProfesoresSeleccionados] = useState([]);
  const [cargandoRecomendaciones, setCargandoRecomendaciones] = useState(false);
  const [busquedaProfesor, setBusquedaProfesor] = useState('');
  const [eventoDetalle, setEventoDetalle] = useState(null);
  const [profesoresAsignados, setProfesoresAsignados] = useState([]);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);

  useEffect(() => {
    cargarEventos();
  }, []);

  // Función para calcular horario de Colorín (una hora antes del cumpleaños)
  const calcularHorarioColorin = (horarioCumpleanos) => {
    if (!horarioCumpleanos || !horarioCumpleanos.includes(':')) return '';
    
    const [horas, minutos] = horarioCumpleanos.split(':').map(Number);
    let horaColorin = horas - 1;
    
    // Si la hora es 0 (medianoche), vuelve a 23 (11 PM del día anterior)
    if (horaColorin < 0) {
      horaColorin = 23;
    }
    
    return `${horaColorin.toString().padStart(2, '0')}:${minutos.toString().padStart(2, '0')}`;
  };

  const cargarEventos = async () => {
    try {
      const response = await eventosAPI.listar();
      // Cargar asignaciones y profesores para cada evento
      const eventosConAsignaciones = await Promise.all(
        response.data.map(async (evento) => {
          try {
            const asignacionesResponse = await asignacionesAPI.listar({ evento_id: evento.id });
            const asignaciones = asignacionesResponse.data;
            
            // Obtener datos de cada profesor asignado
            const profesoresAsignados = await Promise.all(
              asignaciones.map(async (asignacion) => {
                try {
                  const profesorResponse = await profesoresAPI.obtener(asignacion.profesor_id);
                  return {
                    id: profesorResponse.data.id,
                    nombre: profesorResponse.data.nombre,
                    asignacion_id: asignacion.id,
                    rol: asignacion.rol,
                  };
                } catch (error) {
                  console.error(`Error cargando profesor ${asignacion.profesor_id}:`, error);
                  return null;
                }
              })
            );
            
            // Cargar todas las tareas del evento
            let tareasPendientes = [];
            let tareasCompletadas = [];
            let tareasResponse = null;
            try {
              tareasResponse = await tareasEventoAPI.listar(evento.id);
              tareasPendientes = tareasResponse.data.filter(t => !t.completada);
              tareasCompletadas = tareasResponse.data.filter(t => t.completada);
            } catch (error) {
              console.error(`Error cargando tareas del evento ${evento.id}:`, error);
            }
            
            return { 
              ...evento, 
              asignaciones: asignaciones,
              profesoresAsignados: profesoresAsignados.filter(p => p !== null),
              tareasPendientes: tareasPendientes,
              tareasCompletadas: tareasCompletadas,
              todasLasTareas: tareasResponse?.data || []
            };
          } catch {
            return { ...evento, asignaciones: [], profesoresAsignados: [], tareasPendientes: [] };
          }
        })
      );
      setEventos(eventosConAsignaciones);
    } catch (error) {
      console.error('Error cargando eventos:', error);
      alert('Error al cargar eventos');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Prevenir doble envío
    if (submitting) return;
    setSubmitting(true);
    
    try {
      // Convertir lista de cosas entregadas a string separado por comas
      const cosasEntregadasTexto = cosasEntregadasLista.length > 0 
        ? cosasEntregadasLista.join(', ') 
        : null;

      const data = {
        ...formData,
        fecha: formData.fecha,
        cantidad_profes: formData.cantidad_profes && formData.cantidad_profes > 0 ? formData.cantidad_profes : 1,
        cosas_entregadas: cosasEntregadasTexto,
      };
      let eventoId;
      if (editingId) {
        await eventosAPI.actualizar(editingId, data);
        eventoId = editingId;
        
        // Al editar, obtener tareas existentes y sincronizar
        const tareasExistentes = await tareasEventoAPI.listar(eventoId);
        const tareasExistentesDescripciones = tareasExistentes.data.map(t => t.descripcion);
        
        // Eliminar tareas que ya no están en el formulario
        const tareasAEliminar = tareasExistentes.data.filter(
          t => !tareasFormulario.includes(t.descripcion)
        );
        await Promise.all(
          tareasAEliminar.map(t => tareasEventoAPI.eliminar(eventoId, t.id))
        );
        
        // Crear solo las tareas nuevas que no existen
        const tareasNuevas = tareasFormulario.filter(
          t => !tareasExistentesDescripciones.includes(t)
        );
        if (tareasNuevas.length > 0) {
          await Promise.all(
            tareasNuevas.map(tarea => 
              tareasEventoAPI.crear(eventoId, { descripcion: tarea })
            )
          );
        }
      } else {
        const response = await eventosAPI.crear(data);
        eventoId = response.data.id;
        
        // Crear las tareas del formulario solo para eventos nuevos
        if (tareasFormulario.length > 0) {
          await Promise.all(
            tareasFormulario.map(tarea => 
              tareasEventoAPI.crear(eventoId, { descripcion: tarea })
            )
          );
        }
      }
      
      setShowForm(false);
      setFormData({
        nombre: '',
        fecha: '',
        tipo: 'cumpleaños',
        ubicacion: '',
        horario_colorin: '',
        horario_cumpleanos: '',
        actividad: [],
        notas: '',
        cantidad_profes: 1,
        mobiliario: '',
        organizador: '',
        cosas_entregadas: '',
      });
      setActividadPersonalizada('');
      setTareasFormulario([]);
      setNuevaTareaFormulario('');
      setCosasEntregadasLista([]);
      setNuevaCosaEntregada('');
      setEditingId(null);
      cargarEventos();
    } catch (error) {
      console.error('Error guardando evento:', error);
      alert(error.response?.data?.detail || 'Error al guardar evento');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (evento, e) => {
    // Prevenir propagación si viene de un evento click
    if (e) {
      e.stopPropagation();
    }
    
    // Cerrar el modal de detalle si está abierto
    setEventoDetalle(null);
    setProfesoresAsignados([]);
    setTareasEvento([]);
    setMostrarFormTarea(false);
    setNuevaTareaDescripcion('');
    
    // Asegurar que actividad sea un array
    let actividadArray = [];
    let textoOtros = '';
    
    if (evento.actividad) {
      if (Array.isArray(evento.actividad)) {
        actividadArray = evento.actividad;
      } else if (typeof evento.actividad === 'string') {
        // Si es string antiguo, convertirlo a array
        actividadArray = evento.actividad ? [evento.actividad] : [];
      }
      
      // Extraer texto personalizado de "Otros: "
      const otrosActividad = actividadArray.find(a => a.startsWith('Otros: '));
      if (otrosActividad) {
        textoOtros = otrosActividad.replace('Otros: ', '');
      }
    }
    
    setFormData({
      nombre: evento.nombre,
      fecha: evento.fecha,
      tipo: evento.tipo,
      ubicacion: evento.ubicacion || '',
      horario_colorin: evento.horario_colorin || '',
      horario_cumpleanos: evento.horario_cumpleanos || '',
      actividad: actividadArray,
      notas: evento.notas || '',
      cantidad_profes: evento.cantidad_profes || 1,
      mobiliario: evento.mobiliario || '',
      organizador: evento.organizador || '',
      cosas_entregadas: evento.cosas_entregadas || '',
    });
    setActividadPersonalizada(textoOtros);
    setEditingId(evento.id);
    
    // Cargar tareas existentes del evento
    cargarTareasParaEdicion(evento.id);
    
    // Cargar cosas entregadas como lista
    if (evento.cosas_entregadas) {
      // Si está separado por comas, dividir en lista
      const cosasLista = evento.cosas_entregadas.split(',').map(c => c.trim()).filter(c => c);
      setCosasEntregadasLista(cosasLista);
    } else {
      setCosasEntregadasLista([]);
    }
    
    setShowForm(true);
  };

  const cargarTareasParaEdicion = async (eventoId) => {
    try {
      const response = await tareasEventoAPI.listar(eventoId);
      const tareas = response.data.map(t => t.descripcion);
      setTareasFormulario(tareas);
    } catch (error) {
      console.error('Error cargando tareas para edición:', error);
      setTareasFormulario([]);
    }
  };

  const agregarTareaFormulario = () => {
    if (nuevaTareaFormulario.trim()) {
      setTareasFormulario([...tareasFormulario, nuevaTareaFormulario.trim()]);
      setNuevaTareaFormulario('');
    }
  };

  const eliminarTareaFormulario = (index) => {
    setTareasFormulario(tareasFormulario.filter((_, i) => i !== index));
  };

  const agregarCosaEntregada = () => {
    if (nuevaCosaEntregada.trim()) {
      setCosasEntregadasLista([...cosasEntregadasLista, nuevaCosaEntregada.trim()]);
      setNuevaCosaEntregada('');
    }
  };

  const eliminarCosaEntregada = (index) => {
    setCosasEntregadasLista(cosasEntregadasLista.filter((_, i) => i !== index));
  };

  const toggleActividad = (actividad) => {
    setFormData(prev => {
      const actividades = prev.actividad || [];
      
      // Si es "Otros", manejar diferente
      if (actividad === 'Otros') {
        if (actividades.some(a => a.startsWith('Otros: '))) {
          // Si ya hay un "Otros", removerlo
          return { ...prev, actividad: actividades.filter(a => !a.startsWith('Otros: ')) };
        } else {
          // Agregar "Otros" con texto personalizado
          const textoOtros = actividadPersonalizada.trim() || 'Otros';
          return { ...prev, actividad: [...actividades, `Otros: ${textoOtros}`] };
        }
      }
      
      // Para actividades normales
      if (actividades.includes(actividad)) {
        return { ...prev, actividad: actividades.filter(a => a !== actividad) };
      } else {
        return { ...prev, actividad: [...actividades, actividad] };
      }
    });
  };

  const handleActividadPersonalizadaChange = (texto) => {
    setActividadPersonalizada(texto);
    setFormData(prev => {
      const actividades = prev.actividad || [];
      // Remover cualquier "Otros" anterior y agregar el nuevo
      const sinOtros = actividades.filter(a => !a.startsWith('Otros: '));
      if (texto.trim()) {
        return { ...prev, actividad: [...sinOtros, `Otros: ${texto.trim()}`] };
      } else {
        return { ...prev, actividad: sinOtros };
      }
    });
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Estás seguro de eliminar este evento? Se eliminarán todas las asignaciones.')) return;
    try {
      await eventosAPI.eliminar(id);
      cargarEventos();
    } catch (error) {
      console.error('Error eliminando evento:', error);
      alert(error.response?.data?.detail || 'Error al eliminar evento');
    }
  };

  const handleAsignarAutomatico = async (eventoId) => {
    try {
      await eventosAPI.asignarAutomatico(eventoId, cantidadProfes);
      alert(`Se asignaron ${cantidadProfes} profesores al evento`);
      setAsignacionModal(null);
      cargarEventos();
    } catch (error) {
      console.error('Error asignando profesores:', error);
      alert(error.response?.data?.detail || 'Error al asignar profesores');
    }
  };

  const cargarProfesoresRecomendados = async (eventoId) => {
    setCargandoRecomendaciones(true);
    try {
      const response = await recomendacionesAPI.profesoresRecomendados(eventoId);
      setProfesoresRecomendados(response.data.profesores || []);
      setAsignacionManualModal(eventoId);
      setProfesoresSeleccionados([]);
      setBusquedaProfesor('');
    } catch (error) {
      console.error('Error cargando recomendaciones:', error);
      alert('Error al cargar profesores recomendados');
    } finally {
      setCargandoRecomendaciones(false);
    }
  };

  const toggleProfesorSeleccionado = (profesorId) => {
    setProfesoresSeleccionados((prev) => {
      if (prev.includes(profesorId)) {
        return prev.filter((id) => id !== profesorId);
      } else {
        return [...prev, profesorId];
      }
    });
  };

  const handleAsignarManual = async () => {
    if (profesoresSeleccionados.length === 0) {
      alert('Selecciona al menos un profesor');
      return;
    }

    try {
      const asignaciones = profesoresSeleccionados.map((profesorId) => ({
        profesor_id: profesorId,
        evento_id: asignacionManualModal,
        rol: 'Profesor',
      }));

      const response = await asignacionesAPI.crearMultiples(asignaciones);
      if (response.data.errores && response.data.errores.length > 0) {
        alert(`Algunas asignaciones fallaron:\n${response.data.errores.join('\n')}`);
      } else {
        alert(`Se asignaron ${response.data.total_creadas} profesores al evento`);
      }
      setAsignacionManualModal(null);
      setProfesoresSeleccionados([]);
      cargarEventos();
      // Si hay un detalle abierto, recargar los datos
      if (eventoDetalle) {
        verDetalleEvento(eventoDetalle.id);
      }
    } catch (error) {
      console.error('Error asignando profesores:', error);
      alert(error.response?.data?.detail || 'Error al asignar profesores');
    }
  };

  const verDetalleEvento = async (eventoId) => {
    setCargandoDetalle(true);
    try {
      // Obtener datos del evento
      const eventoResponse = await eventosAPI.obtener(eventoId);
      setEventoDetalle(eventoResponse.data);
      // Cargar tareas del evento
      cargarTareasEvento(eventoId);

      // Obtener asignaciones y luego los profesores
      const asignacionesResponse = await asignacionesAPI.listar({ evento_id: eventoId });
      const asignaciones = asignacionesResponse.data;

      // Obtener datos de cada profesor asignado
      const profesoresData = await Promise.all(
        asignaciones.map(async (asignacion) => {
          try {
            const profesorResponse = await profesoresAPI.obtener(asignacion.profesor_id);
            return {
              ...profesorResponse.data,
              asignacion_id: asignacion.id,
              rol: asignacion.rol,
            };
          } catch (error) {
            console.error(`Error cargando profesor ${asignacion.profesor_id}:`, error);
            return null;
          }
        })
      );

      setProfesoresAsignados(profesoresData.filter((p) => p !== null));
    } catch (error) {
      console.error('Error cargando detalle del evento:', error);
      alert('Error al cargar los detalles del evento');
    } finally {
      setCargandoDetalle(false);
    }
  };

  const cargarTareasEvento = async (eventoId) => {
    setCargandoTareas(true);
    try {
      const response = await tareasEventoAPI.listar(eventoId);
      setTareasEvento(response.data);
    } catch (error) {
      console.error('Error cargando tareas del evento:', error);
      setTareasEvento([]);
    } finally {
      setCargandoTareas(false);
    }
  };

  const handleCrearTareaEvento = async (e) => {
    e.preventDefault();
    if (!nuevaTareaDescripcion.trim() || !eventoDetalle) return;
    
    try {
      await tareasEventoAPI.crear(eventoDetalle.id, { descripcion: nuevaTareaDescripcion.trim() });
      setNuevaTareaDescripcion('');
      setMostrarFormTarea(false);
      cargarTareasEvento(eventoDetalle.id);
    } catch (error) {
      console.error('Error creando tarea:', error);
      alert(error.response?.data?.detail || 'Error al crear la tarea');
    }
  };

  const handleToggleTareaEvento = async (tareaId, eventoId = null) => {
    const idEvento = eventoId || eventoDetalle?.id;
    if (!idEvento) return;
    
    try {
      await tareasEventoAPI.toggle(idEvento, tareaId);
      
      // Si estamos en el detalle, recargar tareas del detalle
      if (eventoDetalle && idEvento === eventoDetalle.id) {
        cargarTareasEvento(eventoDetalle.id);
      }
      
      // Recargar eventos para actualizar la lista
      cargarEventos();
    } catch (error) {
      console.error('Error cambiando estado de tarea:', error);
      alert('Error al cambiar el estado de la tarea');
    }
  };

  const handleEliminarTareaEvento = async (tareaId) => {
    if (!eventoDetalle) return;
    if (!confirm('¿Estás seguro de eliminar esta tarea?')) return;
    
    try {
      await tareasEventoAPI.eliminar(eventoDetalle.id, tareaId);
      cargarTareasEvento(eventoDetalle.id);
    } catch (error) {
      console.error('Error eliminando tarea:', error);
      alert(error.response?.data?.detail || 'Error al eliminar la tarea');
    }
  };

  const eliminarAsignacion = async (asignacionId, profesorNombre) => {
    if (!confirm(`¿Estás seguro de quitar a ${profesorNombre} de este evento?`)) {
      return;
    }

    try {
      await asignacionesAPI.eliminar(asignacionId);
      alert(`${profesorNombre} ha sido removido del evento`);
      cargarEventos();
      // Recargar detalle si está abierto
      if (eventoDetalle) {
        verDetalleEvento(eventoDetalle.id);
      }
    } catch (error) {
      console.error('Error eliminando asignación:', error);
      alert(error.response?.data?.detail || 'Error al eliminar la asignación');
    }
  };

  const formatearHora = (hora) => {
    if (!hora) return '';
    // Si la hora ya está en formato HH:MM, simplemente devolverla en formato 24 horas
    const partes = hora.split(':');
    if (partes.length === 2) {
      const horas = partes[0].padStart(2, '0');
      const minutos = partes[1];
      return `${horas}:${minutos}`;
    }
    return hora;
  };

  const generarPDFEntrega = () => {
    if (!eventoDetalle) return;

    // Parsear cosas entregadas
    const cosasEntregadas = eventoDetalle.cosas_entregadas 
      ? eventoDetalle.cosas_entregadas.split(',').map(c => c.trim()).filter(c => c)
      : [];

    if (cosasEntregadas.length === 0) {
      alert('No hay cosas entregadas para generar el PDF');
      return;
    }

    // Formatear fecha
    const fecha = new Date(eventoDetalle.fecha);
    const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 
                   'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
    const fechaFormateada = `${fecha.getDate()} de ${meses[fecha.getMonth()]} de ${fecha.getFullYear()}`;

    // Obtener primer profesor asignado
    const primerProfe = profesoresAsignados.length > 0 
      ? profesoresAsignados[0].nombre 
      : 'Sin asignar';

    // Crear PDF
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;
    let yPos = margin + 10;

    // Título
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    const titulo = 'ENTREGA DE MATERIALES COLORÍN COLORADO';
    const tituloWidth = doc.getTextWidth(titulo);
    doc.text(titulo, (pageWidth - tituloWidth) / 2, yPos);
    yPos += 20;

    // Información del evento
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text('EVENTO:', margin, yPos);
    doc.text(eventoDetalle.nombre, margin + 30, yPos);
    yPos += 7;

    doc.text('FECHA:', margin, yPos);
    doc.text(fechaFormateada, margin + 30, yPos);
    yPos += 7;

    doc.text('PROFE:', margin, yPos);
    doc.text(primerProfe.toUpperCase(), margin + 30, yPos);
    yPos += 12;

    // Texto introductorio
    doc.setFontSize(10);
    const texto1 = 'Se realiza la entrega de los materiales para el evento';
    doc.text(texto1, margin, yPos);
    yPos += 6;

    const texto2 = 'A continuación se da comienzo a la verificación física de los materiales y equipos que a continuación se detallan.';
    const texto2Lines = doc.splitTextToSize(texto2, pageWidth - 2 * margin);
    doc.text(texto2Lines, margin, yPos);
    yPos += texto2Lines.length * 5 + 8;

    // Encabezados de la tabla
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    
    // Definir posiciones de columnas más precisas
    const colN = margin;
    const colMateriales = margin + 12;
    const colCantidad = pageWidth - margin - 50;
    const colObservacion = pageWidth - margin - 25;

    doc.text('N°', colN, yPos);
    doc.text('MATERIALES', colMateriales, yPos);
    doc.text('CANTIDAD', colCantidad, yPos);
    doc.text('OBSERVACIÓN', colObservacion, yPos);
    yPos += 6;

    // Línea debajo de encabezados
    doc.setLineWidth(0.5);
    doc.line(margin, yPos, pageWidth - margin, yPos);
    yPos += 8;

    // Datos de materiales
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    cosasEntregadas.forEach((cosa, index) => {
      // Verificar si necesitamos una nueva página
      if (yPos > pageHeight - 50) {
        doc.addPage();
        yPos = margin + 10;
      }

      // Intentar extraer cantidad y nombre del material
      const match = cosa.match(/^(\d+)\s+(.+)$/);
      const cantidad = match ? match[1] : '';
      const material = match ? match[2] : cosa;

      // Número
      doc.text((index + 1).toString(), colN, yPos);
      
      // Material - puede ser largo, dividirlo en líneas si es necesario
      const anchoMaterial = colCantidad - colMateriales - 5;
      const materialLines = doc.splitTextToSize(material, anchoMaterial);
      doc.text(materialLines, colMateriales, yPos);
      
      // Cantidad (alineada a la derecha)
      if (cantidad) {
        const cantidadWidth = doc.getTextWidth(cantidad);
        doc.text(cantidad, colCantidad + 20 - cantidadWidth, yPos);
      }
      
      // Observación vacía
      doc.text('', colObservacion, yPos);

      // Ajustar yPos según la cantidad de líneas del material
      const alturaFila = Math.max(materialLines.length * 5, 5);
      yPos += alturaFila + 2;
    });

    yPos += 15;

    // Firma
    if (yPos > pageHeight - 40) {
      doc.addPage();
      yPos = margin + 10;
    }
    doc.setFontSize(10);
    doc.text('Firma:', margin, yPos);
    // Línea para firma
    doc.setLineWidth(0.5);
    doc.line(margin + 25, yPos - 1, pageWidth - margin, yPos - 1);
    yPos += 8;
    // Línea de guiones para firma
    const lineaFirma = '_________________________________________________';
    doc.text(lineaFirma, margin + 25, yPos);

    // Generar nombre del archivo
    const nombreArchivo = `Entrega_Materiales_${eventoDetalle.nombre.replace(/[^a-zA-Z0-9]/g, '_')}_${fecha.getDate()}_${fecha.getMonth() + 1}_${fecha.getFullYear()}.pdf`;

    // Guardar PDF
    doc.save(nombreArchivo);
  };

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

  const formatearFechaCompleta = (fechaString) => {
    if (!fechaString) return '';
    // Si la fecha viene como string ISO (YYYY-MM-DD), formatearla directamente
    if (typeof fechaString === 'string' && fechaString.match(/^\d{4}-\d{2}-\d{2}$/)) {
      const [año, mes, dia] = fechaString.split('-');
      const fecha = new Date(parseInt(año), parseInt(mes) - 1, parseInt(dia));
      return fecha.toLocaleDateString('es-ES', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    }
    // Si es un objeto Date o otro formato, usar el método estándar
    const fecha = new Date(fechaString);
    const año = fecha.getFullYear();
    const mes = fecha.getMonth();
    const dia = fecha.getDate();
    const fechaLocal = new Date(año, mes, dia);
    return fechaLocal.toLocaleDateString('es-ES', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  if (loading) {
    return <Loading text="Cargando eventos..." size="large" />;
  }

  // Función helper para obtener fecha y hora combinadas para ordenamiento
  const obtenerFechaHora = (evento) => {
    if (!evento.fecha) return new Date(0); // Si no hay fecha, poner al inicio
    
    const fecha = new Date(evento.fecha);
    
    // Intentar usar horario_cumpleanos primero, si no existe usar horario_colorin
    const horario = evento.horario_cumpleanos || evento.horario_colorin;
    
    if (horario && horario.includes(':')) {
      const [horas, minutos] = horario.split(':').map(Number);
      fecha.setHours(horas || 0, minutos || 0, 0, 0);
    } else {
      // Si no hay horario, usar mediodía como hora por defecto
      fecha.setHours(12, 0, 0, 0);
    }
    
    return fecha;
  };

  // Separar eventos futuros y pasados
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  
  const eventosFuturos = eventos.filter((evento) => {
    if (!evento.fecha) return false;
    const fechaEvento = new Date(evento.fecha);
    fechaEvento.setHours(0, 0, 0, 0);
    return fechaEvento >= hoy;
  });

  const eventosPasados = eventos.filter((evento) => {
    if (!evento.fecha) return false;
    const fechaEvento = new Date(evento.fecha);
    fechaEvento.setHours(0, 0, 0, 0);
    return fechaEvento < hoy;
  });

  // Ordenar eventos futuros por fecha y hora (más cercanos primero)
  eventosFuturos.sort((a, b) => {
    const fechaHoraA = obtenerFechaHora(a);
    const fechaHoraB = obtenerFechaHora(b);
    return fechaHoraA - fechaHoraB;
  });

  // Ordenar eventos pasados por fecha y hora (más recientes primero)
  eventosPasados.sort((a, b) => {
    const fechaHoraA = obtenerFechaHora(a);
    const fechaHoraB = obtenerFechaHora(b);
    return fechaHoraB - fechaHoraA;
  });

  return (
    <div className="eventos-page">
      <div className="page-header">
        <h2>🎉 Eventos</h2>
        <button
          className="btn btn-primary"
          onClick={() => {
            setShowForm(!showForm);
            setEditingId(null);
            setFormData({
              nombre: '',
              fecha: '',
              tipo: 'cumpleaños',
              ubicacion: '',
              horario_colorin: '',
              horario_cumpleanos: '',
              actividad: '',
              notas: '',
            });
          }}
        >
          {showForm ? '❌ Cancelar' : '➕ Crear Evento'}
        </button>
      </div>

      {showForm && editingId && (
        <div
          className="modal-overlay"
          onClick={() => {
            setShowForm(false);
            setEditingId(null);
            setFormData({
              nombre: '',
              fecha: '',
              tipo: 'cumpleaños',
              ubicacion: '',
              horario_colorin: '',
              horario_cumpleanos: '',
              actividad: [],
              notas: '',
            });
            setActividadPersonalizada('');
          }}
        >
          <div className="modal modal-large" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-detalle">
              <h3>✏️ Editar Evento</h3>
              <button
                className="close-btn"
                onClick={() => {
                  setShowForm(false);
                  setEditingId(null);
                  setFormData({
                    nombre: '',
                    fecha: '',
                    tipo: 'cumpleaños',
                    ubicacion: '',
                    horario_colorin: '',
                    horario_cumpleanos: '',
                    actividad: [],
                    notas: '',
                    cantidad_profes: 1,
                  });
                  setActividadPersonalizada('');
                    setTareasFormulario([]);
                    setNuevaTareaFormulario('');
                    setCosasEntregadasLista([]);
                    setNuevaCosaEntregada('');
                  }}
                >
                  ✕
                </button>
            </div>
            <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Nombre del Evento:</label>
            <input
              type="text"
              value={formData.nombre}
              onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
              required
              placeholder="Ej: Cumpleaños de Juan"
            />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Fecha:</label>
              <input
                type="date"
                value={formData.fecha}
                onChange={(e) => setFormData({ ...formData, fecha: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label>Tipo:</label>
              <select
                value={formData.tipo}
                onChange={(e) => setFormData({ ...formData, tipo: e.target.value })}
                required
              >
                <option value="cumpleaños">Cumpleaños</option>
                <option value="evento_especial">Bautismo</option>
                <option value="corporativo">Corporativo</option>
                <option value="otro">Otro</option>
              </select>
            </div>
          </div>
          <div className="form-group">
            <label>Ubicación:</label>
            <input
              type="text"
              value={formData.ubicacion}
              onChange={(e) => setFormData({ ...formData, ubicacion: e.target.value })}
              placeholder="Ej: Parque Central"
            />
          </div>
          <div className="form-group">
            <label>Actividades (seleccione una o más):</label>
            <div className="actividades-checklist">
              {actividadesDisponibles.map((actividad) => (
                <label key={actividad} className="actividad-checkbox-label">
                  <input
                    type="checkbox"
                    checked={(formData.actividad || []).includes(actividad)}
                    onChange={() => toggleActividad(actividad)}
                  />
                  <span>{actividad}</span>
                </label>
              ))}
              <label className="actividad-checkbox-label">
                <input
                  type="checkbox"
                  checked={(formData.actividad || []).some(a => a.startsWith('Otros: '))}
                  onChange={() => toggleActividad('Otros')}
                />
                <span>Otros</span>
              </label>
            </div>
            {(formData.actividad || []).some(a => a.startsWith('Otros: ')) && (
              <div className="actividad-personalizada-input">
                <label>Especifique la actividad personalizada:</label>
                <input
                  type="text"
                  value={actividadPersonalizada}
                  onChange={(e) => handleActividadPersonalizadaChange(e.target.value)}
                  placeholder="Ej: Pintura en tela, Origami, etc."
                  className="input-actividad-personalizada"
                />
              </div>
            )}
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Horario Colorín (24h):</label>
              <input
                type="text"
                value={formData.horario_colorin}
                onChange={(e) => {
                  let valor = e.target.value.replace(/[^0-9:]/g, '');
                  // Validar formato HH:MM
                  if (valor.length <= 5) {
                    // Permitir entrada mientras se escribe
                    if (valor.length === 2 && !valor.includes(':')) {
                      valor = valor + ':';
                    } else if (valor.length > 2 && !valor.includes(':')) {
                      valor = valor.slice(0, 2) + ':' + valor.slice(2);
                    }
                    // Validar que las horas sean válidas (00-23) y minutos (00-59)
                    if (valor.includes(':')) {
                      const partes = valor.split(':');
                      if (partes[0] && parseInt(partes[0]) > 23) {
                        return; // No permitir horas mayores a 23
                      }
                      if (partes[1] && parseInt(partes[1]) > 59) {
                        return; // No permitir minutos mayores a 59
                      }
                    }
                    setFormData({ ...formData, horario_colorin: valor });
                  }
                }}
                onBlur={(e) => {
                  // Formatear al perder el foco si falta algo
                  let valor = e.target.value;
                  if (valor && valor.length === 4 && !valor.includes(':')) {
                    valor = valor.slice(0, 2) + ':' + valor.slice(2);
                  }
                  // Asegurar formato HH:MM completo
                  if (valor && valor.includes(':')) {
                    const partes = valor.split(':');
                    const horas = partes[0].padStart(2, '0').slice(0, 2);
                    const minutos = partes[1] ? partes[1].padEnd(2, '0').slice(0, 2) : '00';
                    if (parseInt(horas) <= 23 && parseInt(minutos) <= 59) {
                      setFormData({ ...formData, horario_colorin: `${horas}:${minutos}` });
                    }
                  }
                }}
                placeholder="HH:MM (ej: 10:00)"
                pattern="^([0-1][0-9]|2[0-3]):[0-5][0-9]$"
              />
            </div>
            <div className="form-group">
              <label>Horario de Cumpleaños (24h):</label>
              <input
                type="text"
                value={formData.horario_cumpleanos}
                onChange={(e) => {
                  let valor = e.target.value.replace(/[^0-9:]/g, '');
                  // Validar formato HH:MM
                  if (valor.length <= 5) {
                    // Permitir entrada mientras se escribe
                    if (valor.length === 2 && !valor.includes(':')) {
                      valor = valor + ':';
                    } else if (valor.length > 2 && !valor.includes(':')) {
                      valor = valor.slice(0, 2) + ':' + valor.slice(2);
                    }
                    // Validar que las horas sean válidas (00-23) y minutos (00-59)
                    if (valor.includes(':')) {
                      const partes = valor.split(':');
                      if (partes[0] && parseInt(partes[0]) > 23) {
                        return; // No permitir horas mayores a 23
                      }
                      if (partes[1] && parseInt(partes[1]) > 59) {
                        return; // No permitir minutos mayores a 59
                      }
                    }
                    setFormData({ ...formData, horario_cumpleanos: valor });
                  }
                }}
                onBlur={(e) => {
                  // Formatear al perder el foco si falta algo
                  let valor = e.target.value;
                  if (valor && valor.length === 4 && !valor.includes(':')) {
                    valor = valor.slice(0, 2) + ':' + valor.slice(2);
                  }
                  // Asegurar formato HH:MM completo
                  if (valor && valor.includes(':')) {
                    const partes = valor.split(':');
                    const horas = partes[0].padStart(2, '0').slice(0, 2);
                    const minutos = partes[1] ? partes[1].padEnd(2, '0').slice(0, 2) : '00';
                    if (parseInt(horas) <= 23 && parseInt(minutos) <= 59) {
                      const horarioCumpleanos = `${horas}:${minutos}`;
                      const horarioColorin = calcularHorarioColorin(horarioCumpleanos);
                      setFormData({ 
                        ...formData, 
                        horario_cumpleanos: horarioCumpleanos,
                        horario_colorin: horarioColorin
                      });
                    }
                  }
                }}
                placeholder="HH:MM (ej: 14:30)"
                pattern="^([0-1][0-9]|2[0-3]):[0-5][0-9]$"
              />
            </div>
          </div>
          <div className="form-group">
            <label>Cantidad de Profes:</label>
            <input
              type="number"
              min="1"
              value={formData.cantidad_profes || ''}
              onChange={(e) => {
                const valor = e.target.value;
                if (valor === '') {
                  setFormData({ ...formData, cantidad_profes: '' });
                } else {
                  const num = parseInt(valor);
                  if (!isNaN(num) && num > 0) {
                    setFormData({ ...formData, cantidad_profes: num });
                  }
                }
              }}
              onBlur={(e) => {
                if (e.target.value === '' || parseInt(e.target.value) < 1) {
                  setFormData({ ...formData, cantidad_profes: 1 });
                }
              }}
              onFocus={(e) => e.target.select()}
              placeholder="Ej: 2"
            />
          </div>
          <div className="form-group">
            <label>Tareas del Evento:</label>
            <div className="tareas-formulario-container">
              <div className="tareas-formulario-input">
                <input
                  type="text"
                  value={nuevaTareaFormulario}
                  onChange={(e) => setNuevaTareaFormulario(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      agregarTareaFormulario();
                    }
                  }}
                  placeholder="Escribe una tarea y presiona Enter o haz clic en ➕"
                />
                <button
                  type="button"
                  className="btn btn-sm btn-primary"
                  onClick={agregarTareaFormulario}
                  disabled={!nuevaTareaFormulario.trim()}
                >
                  ➕ Agregar
                </button>
              </div>
              {tareasFormulario.length > 0 && (
                <div className="tareas-formulario-lista">
                  {tareasFormulario.map((tarea, index) => (
                    <div key={index} className="tarea-formulario-item">
                      <span className="tarea-formulario-texto">✓ {tarea}</span>
                      <button
                        type="button"
                        className="btn-eliminar-tarea"
                        onClick={() => eliminarTareaFormulario(index)}
                        title="Eliminar tarea"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="form-group">
            <label>Notas:</label>
            <textarea
              value={formData.notas}
              onChange={(e) => setFormData({ ...formData, notas: e.target.value })}
              rows="3"
              placeholder="Información adicional..."
            />
          </div>
          <div className="form-group">
            <label>Mobiliario:</label>
            <textarea
              value={formData.mobiliario}
              onChange={(e) => setFormData({ ...formData, mobiliario: e.target.value })}
              rows="3"
              placeholder="Ej: Mesas, sillas, manteles, decoración..."
            />
          </div>
          <div className="form-group">
            <label>Organizador del Evento:</label>
            <input
              type="text"
              value={formData.organizador}
              onChange={(e) => setFormData({ ...formData, organizador: e.target.value })}
              placeholder="Ej: The Vow, Eventos ABC..."
            />
          </div>
          <div className="form-group">
            <label>📦 Cosas Entregadas:</label>
            <div className="cosas-entregadas-container">
              <div className="cosas-entregadas-input">
                <input
                  type="text"
                  value={nuevaCosaEntregada}
                  onChange={(e) => setNuevaCosaEntregada(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      agregarCosaEntregada();
                    }
                  }}
                  placeholder="Ej: 40 lienzos, 40 peluches, 3 colores batas..."
                  className="input-cosa-entregada"
                />
                <button
                  type="button"
                  className="btn btn-sm btn-primary"
                  onClick={agregarCosaEntregada}
                >
                  ➕ Agregar
                </button>
              </div>
              {cosasEntregadasLista.length > 0 && (
                <div className="cosas-entregadas-lista">
                  {cosasEntregadasLista.map((cosa, index) => (
                    <div key={index} className="cosa-entregada-item">
                      <span className="cosa-entregada-texto">{cosa}</span>
                      <button
                        type="button"
                        className="btn-eliminar-cosa"
                        onClick={() => eliminarCosaEntregada(index)}
                        title="Eliminar"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setShowForm(false);
                    setEditingId(null);
                    setFormData({
                      nombre: '',
                      fecha: '',
                      tipo: 'cumpleaños',
                      ubicacion: '',
                      horario_colorin: '',
                      horario_cumpleanos: '',
                      actividad: [],
                      notas: '',
                    });
                    setActividadPersonalizada('');
                  }}
                >
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? '⏳ Guardando...' : '💾 Guardar Cambios'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showForm && !editingId && (
        <form className="form-card" onSubmit={handleSubmit}>
          <h3>Nuevo Evento</h3>
          <div className="form-group">
            <label>Nombre del Evento:</label>
            <input
              type="text"
              value={formData.nombre}
              onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
              required
              placeholder="Ej: Cumpleaños de Juan"
            />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Fecha:</label>
              <input
                type="date"
                value={formData.fecha}
                onChange={(e) => setFormData({ ...formData, fecha: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label>Tipo:</label>
              <select
                value={formData.tipo}
                onChange={(e) => setFormData({ ...formData, tipo: e.target.value })}
                required
              >
                <option value="cumpleaños">Cumpleaños</option>
                <option value="evento_especial">Bautismo</option>
                <option value="corporativo">Corporativo</option>
                <option value="otro">Otro</option>
              </select>
            </div>
          </div>
          <div className="form-group">
            <label>Ubicación:</label>
            <input
              type="text"
              value={formData.ubicacion}
              onChange={(e) => setFormData({ ...formData, ubicacion: e.target.value })}
              placeholder="Ej: Parque Central"
            />
          </div>
          <div className="form-group">
            <label>Actividades (seleccione una o más):</label>
            <div className="actividades-checklist">
              {actividadesDisponibles.map((actividad) => (
                <label key={actividad} className="actividad-checkbox-label">
                  <input
                    type="checkbox"
                    checked={(formData.actividad || []).includes(actividad)}
                    onChange={() => toggleActividad(actividad)}
                  />
                  <span>{actividad}</span>
                </label>
              ))}
              <label className="actividad-checkbox-label">
                <input
                  type="checkbox"
                  checked={(formData.actividad || []).some(a => a.startsWith('Otros: '))}
                  onChange={() => toggleActividad('Otros')}
                />
                <span>Otros</span>
              </label>
            </div>
            {(formData.actividad || []).some(a => a.startsWith('Otros: ')) && (
              <div className="actividad-personalizada-input">
                <label>Especifique la actividad personalizada:</label>
                <input
                  type="text"
                  value={actividadPersonalizada}
                  onChange={(e) => handleActividadPersonalizadaChange(e.target.value)}
                  placeholder="Ej: Pintura en tela, Origami, etc."
                  className="input-actividad-personalizada"
                />
              </div>
            )}
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Horario Colorín (24h):</label>
              <input
                type="text"
                value={formData.horario_colorin}
                onChange={(e) => {
                  let valor = e.target.value.replace(/[^0-9:]/g, '');
                  // Validar formato HH:MM
                  if (valor.length <= 5) {
                    // Permitir entrada mientras se escribe
                    if (valor.length === 2 && !valor.includes(':')) {
                      valor = valor + ':';
                    } else if (valor.length > 2 && !valor.includes(':')) {
                      valor = valor.slice(0, 2) + ':' + valor.slice(2);
                    }
                    // Validar que las horas sean válidas (00-23) y minutos (00-59)
                    if (valor.includes(':')) {
                      const partes = valor.split(':');
                      if (partes[0] && parseInt(partes[0]) > 23) {
                        return; // No permitir horas mayores a 23
                      }
                      if (partes[1] && parseInt(partes[1]) > 59) {
                        return; // No permitir minutos mayores a 59
                      }
                    }
                    setFormData({ ...formData, horario_colorin: valor });
                  }
                }}
                onBlur={(e) => {
                  // Formatear al perder el foco si falta algo
                  let valor = e.target.value;
                  if (valor && valor.length === 4 && !valor.includes(':')) {
                    valor = valor.slice(0, 2) + ':' + valor.slice(2);
                  }
                  // Asegurar formato HH:MM completo
                  if (valor && valor.includes(':')) {
                    const partes = valor.split(':');
                    const horas = partes[0].padStart(2, '0').slice(0, 2);
                    const minutos = partes[1] ? partes[1].padEnd(2, '0').slice(0, 2) : '00';
                    if (parseInt(horas) <= 23 && parseInt(minutos) <= 59) {
                      setFormData({ ...formData, horario_colorin: `${horas}:${minutos}` });
                    }
                  }
                }}
                placeholder="HH:MM (ej: 10:00)"
                pattern="^([0-1][0-9]|2[0-3]):[0-5][0-9]$"
              />
            </div>
            <div className="form-group">
              <label>Horario de Cumpleaños (24h):</label>
              <input
                type="text"
                value={formData.horario_cumpleanos}
                onChange={(e) => {
                  let valor = e.target.value.replace(/[^0-9:]/g, '');
                  // Validar formato HH:MM
                  if (valor.length <= 5) {
                    // Permitir entrada mientras se escribe
                    if (valor.length === 2 && !valor.includes(':')) {
                      valor = valor + ':';
                    } else if (valor.length > 2 && !valor.includes(':')) {
                      valor = valor.slice(0, 2) + ':' + valor.slice(2);
                    }
                    // Validar que las horas sean válidas (00-23) y minutos (00-59)
                    if (valor.includes(':')) {
                      const partes = valor.split(':');
                      if (partes[0] && parseInt(partes[0]) > 23) {
                        return; // No permitir horas mayores a 23
                      }
                      if (partes[1] && parseInt(partes[1]) > 59) {
                        return; // No permitir minutos mayores a 59
                      }
                    }
                    setFormData({ ...formData, horario_cumpleanos: valor });
                  }
                }}
                onBlur={(e) => {
                  // Formatear al perder el foco si falta algo
                  let valor = e.target.value;
                  if (valor && valor.length === 4 && !valor.includes(':')) {
                    valor = valor.slice(0, 2) + ':' + valor.slice(2);
                  }
                  // Asegurar formato HH:MM completo
                  if (valor && valor.includes(':')) {
                    const partes = valor.split(':');
                    const horas = partes[0].padStart(2, '0').slice(0, 2);
                    const minutos = partes[1] ? partes[1].padEnd(2, '0').slice(0, 2) : '00';
                    if (parseInt(horas) <= 23 && parseInt(minutos) <= 59) {
                      const horarioCumpleanos = `${horas}:${minutos}`;
                      const horarioColorin = calcularHorarioColorin(horarioCumpleanos);
                      setFormData({ 
                        ...formData, 
                        horario_cumpleanos: horarioCumpleanos,
                        horario_colorin: horarioColorin
                      });
                    }
                  }
                }}
                placeholder="HH:MM (ej: 14:30)"
                pattern="^([0-1][0-9]|2[0-3]):[0-5][0-9]$"
              />
            </div>
          </div>
          <div className="form-group">
            <label>Cantidad de Profes:</label>
            <input
              type="number"
              min="1"
              value={formData.cantidad_profes || ''}
              onChange={(e) => {
                const valor = e.target.value;
                if (valor === '') {
                  setFormData({ ...formData, cantidad_profes: '' });
                } else {
                  const num = parseInt(valor);
                  if (!isNaN(num) && num > 0) {
                    setFormData({ ...formData, cantidad_profes: num });
                  }
                }
              }}
              onBlur={(e) => {
                if (e.target.value === '' || parseInt(e.target.value) < 1) {
                  setFormData({ ...formData, cantidad_profes: 1 });
                }
              }}
              onFocus={(e) => e.target.select()}
              placeholder="Ej: 2"
            />
          </div>
          <div className="form-group">
            <label>Tareas del Evento:</label>
            <div className="tareas-formulario-container">
              <div className="tareas-formulario-input">
                <input
                  type="text"
                  value={nuevaTareaFormulario}
                  onChange={(e) => setNuevaTareaFormulario(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      agregarTareaFormulario();
                    }
                  }}
                  placeholder="Escribe una tarea y presiona Enter o haz clic en ➕"
                />
                <button
                  type="button"
                  className="btn btn-sm btn-primary"
                  onClick={agregarTareaFormulario}
                  disabled={!nuevaTareaFormulario.trim()}
                >
                  ➕ Agregar
                </button>
              </div>
              {tareasFormulario.length > 0 && (
                <div className="tareas-formulario-lista">
                  {tareasFormulario.map((tarea, index) => (
                    <div key={index} className="tarea-formulario-item">
                      <span className="tarea-formulario-texto">✓ {tarea}</span>
                      <button
                        type="button"
                        className="btn-eliminar-tarea"
                        onClick={() => eliminarTareaFormulario(index)}
                        title="Eliminar tarea"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="form-group">
            <label>Notas:</label>
            <textarea
              value={formData.notas}
              onChange={(e) => setFormData({ ...formData, notas: e.target.value })}
              rows="3"
              placeholder="Información adicional..."
            />
          </div>
          <div className="form-group">
            <label>Mobiliario:</label>
            <textarea
              value={formData.mobiliario}
              onChange={(e) => setFormData({ ...formData, mobiliario: e.target.value })}
              rows="3"
              placeholder="Ej: Mesas, sillas, manteles, decoración..."
            />
          </div>
          <div className="form-group">
            <label>Organizador del Evento:</label>
            <input
              type="text"
              value={formData.organizador}
              onChange={(e) => setFormData({ ...formData, organizador: e.target.value })}
              placeholder="Ej: The Vow, Eventos ABC..."
            />
          </div>
          <div className="form-group">
            <label>📦 Cosas Entregadas:</label>
            <div className="cosas-entregadas-container">
              <div className="cosas-entregadas-input">
                <input
                  type="text"
                  value={nuevaCosaEntregada}
                  onChange={(e) => setNuevaCosaEntregada(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      agregarCosaEntregada();
                    }
                  }}
                  placeholder="Ej: 40 lienzos, 40 peluches, 3 colores batas..."
                  className="input-cosa-entregada"
                />
                <button
                  type="button"
                  className="btn btn-sm btn-primary"
                  onClick={agregarCosaEntregada}
                >
                  ➕ Agregar
                </button>
              </div>
              {cosasEntregadasLista.length > 0 && (
                <div className="cosas-entregadas-lista">
                  {cosasEntregadasLista.map((cosa, index) => (
                    <div key={index} className="cosa-entregada-item">
                      <span className="cosa-entregada-texto">{cosa}</span>
                      <button
                        type="button"
                        className="btn-eliminar-cosa"
                        onClick={() => eliminarCosaEntregada(index)}
                        title="Eliminar"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? '⏳ Creando...' : '➕ Crear Evento'}
          </button>
        </form>
      )}

      {/* Eventos Futuros */}
      {eventosFuturos.length > 0 && (
        <div className="eventos-list">
          {eventosFuturos.map((evento) => (
            <div
              key={evento.id}
              className="evento-card"
              onClick={() => verDetalleEvento(evento.id)}
              style={{ cursor: 'pointer' }}
            >
            <div className="evento-header">
              <div>
                <h3>{evento.nombre}</h3>
                <p className="evento-fecha">📅 {formatearFecha(evento.fecha)}</p>
              </div>
              <span className="badge badge-primary">{evento.tipo}</span>
            </div>
            {evento.ubicacion && (
              <p className="evento-ubicacion">📍 {evento.ubicacion}</p>
            )}
            {evento.actividad && Array.isArray(evento.actividad) && evento.actividad.length > 0 && (
              <p className="evento-actividad">
                🎨 Actividades: {evento.actividad.map(a => a.startsWith('Otros: ') ? a.replace('Otros: ', '') : a).join(', ')}
              </p>
            )}
            {evento.actividad && typeof evento.actividad === 'string' && evento.actividad && (
              <p className="evento-actividad">🎨 Actividad: {evento.actividad.replace('Otros: ', '')}</p>
            )}
            {(evento.horario_colorin || evento.horario_cumpleanos) && (
              <div className="evento-horarios">
                {evento.horario_colorin && (
                  <p className="evento-horario">🕐 Horario Colorín: {formatearHora(evento.horario_colorin)}</p>
                )}
                {evento.horario_cumpleanos && (
                  <p className="evento-horario">🎂 Horario de Cumpleaños: {formatearHora(evento.horario_cumpleanos)}</p>
                )}
              </div>
            )}
            {evento.notas && (
              <p className="evento-notas">{evento.notas}</p>
            )}
            {evento.mobiliario && (
              <div className="evento-mobiliario">
                <strong>🪑 Mobiliario:</strong>
                <p>{evento.mobiliario}</p>
              </div>
            )}
            {evento.organizador && (
              <div className="evento-organizador">
                <strong>👤 Organizador:</strong> {evento.organizador}
              </div>
            )}
            {evento.cosas_entregadas && (
              <div className="evento-cosas-entregadas">
                <strong>📦 Cosas Entregadas:</strong>
                <p>{evento.cosas_entregadas}</p>
              </div>
            )}
            {(evento.tareasPendientes?.length > 0 || evento.tareasCompletadas?.length > 0) && (
              <div className="evento-tareas-container" onClick={(e) => e.stopPropagation()}>
                {/* Tareas Pendientes */}
                {evento.tareasPendientes && evento.tareasPendientes.length > 0 && (
                  <div className="evento-tareas-pendientes">
                    <div className="evento-tareas-header">
                      <strong>📋 Tareas pendientes ({evento.tareasPendientes.length}):</strong>
                    </div>
                    <div className="evento-tareas-lista">
                      {evento.tareasPendientes.map((tarea) => (
                        <div key={tarea.id} className="evento-tarea-item">
                          <input
                            type="checkbox"
                            checked={false}
                            onChange={() => handleToggleTareaEvento(tarea.id, evento.id)}
                            className="evento-tarea-checkbox"
                            title="Marcar como completada"
                          />
                          <span className="evento-tarea-texto">{tarea.descripcion}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Tareas Completadas */}
                {evento.tareasCompletadas && evento.tareasCompletadas.length > 0 && (
                  <div className="evento-tareas-completadas">
                    <div className="evento-tareas-header">
                      <strong>✅ Tareas completadas ({evento.tareasCompletadas.length}):</strong>
                    </div>
                    <div className="evento-tareas-lista">
                      {evento.tareasCompletadas.map((tarea) => (
                        <div key={tarea.id} className="evento-tarea-item evento-tarea-completada">
                          <input
                            type="checkbox"
                            checked={true}
                            onChange={() => handleToggleTareaEvento(tarea.id, evento.id)}
                            className="evento-tarea-checkbox"
                            title="Marcar como pendiente"
                          />
                          <span className="evento-tarea-texto">{tarea.descripcion}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
            {(() => {
              const profesoresAsignados = evento.profesoresAsignados?.length || 0;
              const cantidadNecesaria = evento.cantidad_profes || 1;
              const faltanProfesores = profesoresAsignados < cantidadNecesaria;
              
              return (
                <div className={`evento-asignaciones ${faltanProfesores ? 'faltan-profesores' : ''}`} onClick={(e) => e.stopPropagation()}>
                  <div className="evento-profesores-header">
                    <strong>👥 Profesores asignados: {profesoresAsignados}</strong>
                    <span className={`cantidad-profes-badge-resumen ${faltanProfesores ? 'insuficiente' : 'suficiente'}`}>
                      {faltanProfesores ? (
                        <span className="alerta-profesores">⚠️ Faltan {cantidadNecesaria - profesoresAsignados} de {cantidadNecesaria}</span>
                      ) : (
                        <span className="ok-profesores">✓ {profesoresAsignados}/{cantidadNecesaria}</span>
                      )}
                    </span>
                  </div>
                  {evento.profesoresAsignados && evento.profesoresAsignados.length > 0 && (
                    <div className="profesores-nombres">
                      {evento.profesoresAsignados.map((profesor) => (
                        <span key={profesor.asignacion_id} className="profesor-nombre-badge">
                          {profesor.nombre}
                          <button
                            className="btn-eliminar-profesor"
                            onClick={(e) => {
                              e.stopPropagation();
                              eliminarAsignacion(profesor.asignacion_id, profesor.nombre);
                            }}
                            title={`Quitar a ${profesor.nombre} del evento`}
                          >
                            ✕
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}
            <div className="evento-actions" onClick={(e) => e.stopPropagation()}>
              <button
                className="btn btn-sm btn-primary"
                onClick={() => cargarProfesoresRecomendados(evento.id)}
              >
                👥 Elegir Profesores
              </button>
              <button
                className="btn btn-sm btn-secondary"
                onClick={() => {
                  setAsignacionModal(evento.id);
                  setCantidadProfes(evento.asignaciones?.length || 1);
                }}
              >
                ⚡ Asignar Automático
              </button>
              <button
                className="btn btn-sm btn-secondary"
                onClick={(e) => {
                  e.stopPropagation();
                  handleEdit(evento, e);
                }}
              >
                ✏️ Editar
              </button>
              <button
                className="btn btn-sm btn-danger"
                onClick={() => handleDelete(evento.id)}
              >
                🗑️ Eliminar
              </button>
            </div>
          </div>
          ))}
        </div>
      )}

      {/* Eventos Pasados/Completados */}
      {eventosPasados.length > 0 && (
        <>
          <div className="eventos-completados-header">
            <h3>✅ Eventos Completados</h3>
            <p className="eventos-completados-subtitle">
              Eventos que ya pasaron ({eventosPasados.length})
            </p>
          </div>
          <div className="eventos-list eventos-completados">
            {eventosPasados.map((evento) => (
              <div
                key={evento.id}
                className="evento-card evento-completado"
                onClick={() => verDetalleEvento(evento.id)}
                style={{ cursor: 'pointer' }}
              >
                <div className="evento-header">
                  <div>
                    <h3>{evento.nombre}</h3>
                    <p className="evento-fecha">📅 {formatearFecha(evento.fecha)}</p>
                  </div>
                  <span className="badge badge-completado">✅ Completado</span>
                </div>
                {evento.ubicacion && (
                  <p className="evento-ubicacion">📍 {evento.ubicacion}</p>
                )}
                {evento.actividad && Array.isArray(evento.actividad) && evento.actividad.length > 0 && (
                  <p className="evento-actividad">
                    🎨 Actividades: {evento.actividad.map(a => a.startsWith('Otros: ') ? a.replace('Otros: ', '') : a).join(', ')}
                  </p>
                )}
                {evento.actividad && typeof evento.actividad === 'string' && evento.actividad && (
                  <p className="evento-actividad">🎨 Actividad: {evento.actividad.replace('Otros: ', '')}</p>
                )}
                {(evento.horario_colorin || evento.horario_cumpleanos) && (
                  <div className="evento-horarios">
                    {evento.horario_colorin && (
                      <p className="evento-horario">🕐 Horario Colorín: {formatearHora(evento.horario_colorin)}</p>
                    )}
                    {evento.horario_cumpleanos && (
                      <p className="evento-horario">🎂 Horario de Cumpleaños: {formatearHora(evento.horario_cumpleanos)}</p>
                    )}
                  </div>
                )}
                {evento.mobiliario && (
                  <div className="evento-mobiliario">
                    <strong>🪑 Mobiliario:</strong>
                    <p>{evento.mobiliario}</p>
                  </div>
                )}
                {evento.organizador && (
                  <div className="evento-organizador">
                    <strong>👤 Organizador:</strong> {evento.organizador}
                  </div>
                )}
                {evento.cosas_entregadas && (
                  <div className="evento-cosas-entregadas">
                    <strong>📦 Cosas Entregadas:</strong>
                    <p>{evento.cosas_entregadas}</p>
                  </div>
                )}
                {(evento.tareasPendientes?.length > 0 || evento.tareasCompletadas?.length > 0) && (
                  <div className="evento-tareas-container" onClick={(e) => e.stopPropagation()}>
                    {/* Tareas Pendientes */}
                    {evento.tareasPendientes && evento.tareasPendientes.length > 0 && (
                      <div className="evento-tareas-pendientes">
                        <div className="evento-tareas-header">
                          <strong>📋 Tareas pendientes ({evento.tareasPendientes.length}):</strong>
                        </div>
                        <div className="evento-tareas-lista">
                          {evento.tareasPendientes.map((tarea) => (
                            <div key={tarea.id} className="evento-tarea-item">
                              <input
                                type="checkbox"
                                checked={false}
                                onChange={() => handleToggleTareaEvento(tarea.id, evento.id)}
                                className="evento-tarea-checkbox"
                                title="Marcar como completada"
                              />
                              <span className="evento-tarea-texto">{tarea.descripcion}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {/* Tareas Completadas */}
                    {evento.tareasCompletadas && evento.tareasCompletadas.length > 0 && (
                      <div className="evento-tareas-completadas">
                        <div className="evento-tareas-header">
                          <strong>✅ Tareas completadas ({evento.tareasCompletadas.length}):</strong>
                        </div>
                        <div className="evento-tareas-lista">
                          {evento.tareasCompletadas.map((tarea) => (
                            <div key={tarea.id} className="evento-tarea-item evento-tarea-completada">
                              <input
                                type="checkbox"
                                checked={true}
                                onChange={() => handleToggleTareaEvento(tarea.id, evento.id)}
                                className="evento-tarea-checkbox"
                                title="Marcar como pendiente"
                              />
                              <span className="evento-tarea-texto">{tarea.descripcion}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
                {(() => {
                  const profesoresAsignados = evento.profesoresAsignados?.length || 0;
                  return (
                    <div className="evento-asignaciones">
                      <div className="evento-profesores-header">
                        <strong>👥 Profesores asignados: {profesoresAsignados}</strong>
                      </div>
                      {evento.profesoresAsignados && evento.profesoresAsignados.length > 0 && (
                        <div className="profesores-nombres">
                          {evento.profesoresAsignados.map((profesor) => (
                            <span key={profesor.asignacion_id} className="profesor-nombre-badge">
                              {profesor.nombre}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            ))}
          </div>
        </>
      )}

      {eventosFuturos.length === 0 && eventosPasados.length === 0 && (
        <div className="sin-eventos">
          <p>No hay eventos registrados.</p>
        </div>
      )}

      {asignacionModal && (
        <div className="modal-overlay" onClick={() => setAsignacionModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Asignar Profesores Automáticamente</h3>
            <p>Se asignarán los profesores que tengan menos eventos de manera equitativa.</p>
            <div className="form-group">
              <label>Cantidad de profesores:</label>
              <input
                type="number"
                min="1"
                max="20"
                value={cantidadProfes}
                onChange={(e) => setCantidadProfes(parseInt(e.target.value))}
                className="form-control"
              />
            </div>
            <div className="modal-actions">
              <button
                className="btn btn-secondary"
                onClick={() => setAsignacionModal(null)}
              >
                Cancelar
              </button>
              <button
                className="btn btn-primary"
                onClick={() => handleAsignarAutomatico(asignacionModal)}
              >
                ✅ Asignar Automático
              </button>
            </div>
          </div>
        </div>
      )}

      {asignacionManualModal && (
        <div
          className="modal-overlay"
          onClick={() => {
            setAsignacionManualModal(null);
            setProfesoresRecomendados([]);
            setProfesoresSeleccionados([]);
          }}
        >
          <div className="modal modal-large" onClick={(e) => e.stopPropagation()}>
            <h3>👥 Elegir Profesores para el Evento</h3>
            <p className="modal-description">
              Selecciona los profesores que irán al evento. Los profesores están ordenados por
              cantidad de eventos asignados (menos eventos primero). Elige los que confirmen
              disponibilidad.
            </p>

            {cargandoRecomendaciones ? (
              <div className="loading-modal">
                <Loading text="Cargando profesores..." size="medium" />
              </div>
            ) : (
              <>
                {/* Buscador de profesores */}
                <div className="buscador-profesores">
                  <input
                    type="text"
                    placeholder="🔍 Buscar profesor por nombre..."
                    value={busquedaProfesor}
                    onChange={(e) => setBusquedaProfesor(e.target.value)}
                    className="input-busqueda"
                  />
                  {busquedaProfesor && (
                    <button
                      className="btn-limpiar-busqueda"
                      onClick={() => setBusquedaProfesor('')}
                      title="Limpiar búsqueda"
                    >
                      ✕
                    </button>
                  )}
                </div>

                <div className="profesores-list">
                  {profesoresRecomendados
                    .filter((profesor) => {
                      if (!busquedaProfesor.trim()) return true;
                      return profesor.nombre
                        .toLowerCase()
                        .includes(busquedaProfesor.toLowerCase().trim());
                    })
                    .length === 0 && busquedaProfesor.trim() ? (
                      <div className="sin-resultados-busqueda">
                        <p>🔍 No se encontraron profesores con el nombre "{busquedaProfesor}"</p>
                        <button
                          className="btn btn-sm btn-secondary"
                          onClick={() => setBusquedaProfesor('')}
                        >
                          Limpiar búsqueda
                        </button>
                      </div>
                    ) : (
                      profesoresRecomendados
                        .filter((profesor) => {
                          if (!busquedaProfesor.trim()) return true;
                          return profesor.nombre
                            .toLowerCase()
                            .includes(busquedaProfesor.toLowerCase().trim());
                        })
                        .map((profesor) => {
                    const estaSeleccionado = profesoresSeleccionados.includes(profesor.profesor_id);
                    const esRecomendado =
                      profesor.recomendado && profesor.total_eventos_futuros === 0;

                    return (
                      <div
                        key={profesor.profesor_id}
                        className={`profesor-item ${
                          estaSeleccionado ? 'seleccionado' : ''
                        } ${profesor.ya_asignado ? 'ya-asignado' : ''} ${
                          esRecomendado ? 'muy-recomendado' : ''
                        }`}
                        onClick={() => {
                          if (!profesor.ya_asignado) {
                            toggleProfesorSeleccionado(profesor.profesor_id);
                          }
                        }}
                      >
                        <div className="profesor-checkbox">
                          {profesor.ya_asignado ? (
                            <span className="check-disabled">✓ Ya asignado</span>
                          ) : (
                            <input
                              type="checkbox"
                              checked={estaSeleccionado}
                              onChange={() => toggleProfesorSeleccionado(profesor.profesor_id)}
                              onClick={(e) => e.stopPropagation()}
                            />
                          )}
                        </div>
                        <div className="profesor-info">
                          <div className="profesor-nombre">
                            {profesor.nombre}
                            {esRecomendado && (
                              <span className="badge-recomendado">⭐ Recomendado</span>
                            )}
                          </div>
                          <div className="profesor-stats">
                            <span className="eventos-count">
                              {profesor.total_eventos_futuros} eventos asignados
                            </span>
                            {profesor.total_eventos_futuros === 0 && (
                              <span className="sin-eventos">Sin eventos asignados</span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                    )}
                </div>

                {profesoresSeleccionados.length > 0 && (
                  <div className="seleccion-info">
                    <strong>{profesoresSeleccionados.length} profesor(es) seleccionado(s)</strong>
                  </div>
                )}

                <div className="modal-actions">
                  <button
                    className="btn btn-secondary"
                    onClick={() => {
                      setAsignacionManualModal(null);
                      setProfesoresRecomendados([]);
                      setProfesoresSeleccionados([]);
                      setBusquedaProfesor('');
                    }}
                  >
                    Cancelar
                  </button>
                  <button
                    className="btn btn-primary"
                    onClick={handleAsignarManual}
                    disabled={profesoresSeleccionados.length === 0}
                  >
                    ✅ Asignar {profesoresSeleccionados.length > 0 ? `(${profesoresSeleccionados.length})` : ''}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {eventos.length === 0 && (
        <div className="empty-state">
          <p>No hay eventos registrados.</p>
          <button className="btn btn-primary" onClick={() => setShowForm(true)}>
            ➕ Crear Primer Evento
          </button>
        </div>
      )}

      {eventoDetalle && (
        <div
          className="modal-overlay"
          onClick={() => {
            setEventoDetalle(null);
            setProfesoresAsignados([]);
            setTareasEvento([]);
            setMostrarFormTarea(false);
            setNuevaTareaDescripcion('');
          }}
        >
          <div className="modal modal-large" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-detalle">
              <h3>📋 Detalles del Evento</h3>
              <button
                className="close-btn"
                onClick={() => {
                  setEventoDetalle(null);
                  setProfesoresAsignados([]);
                  setTareasEvento([]);
                  setMostrarFormTarea(false);
                  setNuevaTareaDescripcion('');
                }}
              >
                ✕
              </button>
            </div>

            {cargandoDetalle ? (
              <div className="loading-modal">
                <Loading text="Cargando detalles..." size="medium" />
              </div>
            ) : (
              <>
                <div className="evento-detalle-info">
                  <div className="detalle-item">
                    <span className="detalle-label">Nombre:</span>
                    <span className="detalle-value">{eventoDetalle.nombre}</span>
                  </div>
                  <div className="detalle-item">
                    <span className="detalle-label">Fecha:</span>
                    <span className="detalle-value">
                      📅 {formatearFechaCompleta(eventoDetalle.fecha)}
                    </span>
                  </div>
                  <div className="detalle-item">
                    <span className="detalle-label">Tipo:</span>
                    <span className="badge badge-primary">{eventoDetalle.tipo}</span>
                  </div>
                  {eventoDetalle.ubicacion && (
                    <div className="detalle-item">
                      <span className="detalle-label">Ubicación:</span>
                      <span className="detalle-value">📍 {eventoDetalle.ubicacion}</span>
                    </div>
                  )}
                  {eventoDetalle.actividad && (
                    <div className="detalle-item">
                      <span className="detalle-label">Actividades:</span>
                      <span className="detalle-value">
                        🎨 {Array.isArray(eventoDetalle.actividad) 
                          ? eventoDetalle.actividad.map(a => a.startsWith('Otros: ') ? a.replace('Otros: ', '') : a).join(', ')
                          : eventoDetalle.actividad.replace('Otros: ', '')}
                      </span>
                    </div>
                  )}
                  {(eventoDetalle.horario_colorin || eventoDetalle.horario_cumpleanos) && (
                    <div className="detalle-item">
                      <span className="detalle-label">Horarios:</span>
                      <span className="detalle-value">
                        {eventoDetalle.horario_colorin && (
                          <div>🕐 Horario Colorín: {formatearHora(eventoDetalle.horario_colorin)}</div>
                        )}
                        {eventoDetalle.horario_cumpleanos && (
                          <div>🎂 Horario de Cumpleaños: {formatearHora(eventoDetalle.horario_cumpleanos)}</div>
                        )}
                      </span>
                    </div>
                  )}
                  {eventoDetalle.notas && (
                    <div className="detalle-item detalle-notas">
                      <span className="detalle-label">Notas:</span>
                      <p className="detalle-value">{eventoDetalle.notas}</p>
                    </div>
                  )}
                  {eventoDetalle.mobiliario && (
                    <div className="detalle-item detalle-mobiliario">
                      <span className="detalle-label">🪑 Mobiliario:</span>
                      <p className="detalle-value">{eventoDetalle.mobiliario}</p>
                    </div>
                  )}
                  {eventoDetalle.organizador && (
                    <div className="detalle-item detalle-organizador">
                      <span className="detalle-label">👤 Organizador:</span>
                      <p className="detalle-value">{eventoDetalle.organizador}</p>
                    </div>
                  )}
                  {eventoDetalle.cosas_entregadas && (
                    <div className="detalle-item detalle-cosas-entregadas">
                      <span className="detalle-label">📦 Cosas Entregadas:</span>
                      <div className="detalle-value">
                        {eventoDetalle.cosas_entregadas.split(',').map((cosa, index) => (
                          <div key={index} className="cosa-entregada-detalle-item">
                            • {cosa.trim()}
                          </div>
                        ))}
                      </div>
                      <div className="pdf-button-container">
                        <button
                          className="btn btn-success btn-pdf-generar"
                          onClick={generarPDFEntrega}
                          title="Generar PDF de entrega de materiales para imprimir"
                        >
                          📄 Generar PDF de Entrega
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="profesores-asignados-section">
                  <div className="cantidad-profes-info">
                    <h4>👥 Profesores Asignados ({profesoresAsignados.length})</h4>
                    <div className={`cantidad-profes-badge ${profesoresAsignados.length < (eventoDetalle.cantidad_profes || 1) ? 'cantidad-insuficiente' : 'cantidad-suficiente'}`}>
                      <span className="cantidad-label">Cantidad solicitada:</span>
                      <span className="cantidad-numero">{eventoDetalle.cantidad_profes || 1}</span>
                      {profesoresAsignados.length < (eventoDetalle.cantidad_profes || 1) && (
                        <span className="cantidad-alerta">⚠️ Faltan {((eventoDetalle.cantidad_profes || 1) - profesoresAsignados.length)} profesor(es)</span>
                      )}
                    </div>
                  </div>
                  {profesoresAsignados.length === 0 ? (
                    <div className="sin-profesores">
                      <p>No hay profesores asignados a este evento.</p>
                      <button
                        className="btn btn-sm btn-primary"
                        onClick={() => {
                          setEventoDetalle(null);
                          cargarProfesoresRecomendados(eventoDetalle.id);
                        }}
                      >
                        👥 Asignar Profesores
                      </button>
                    </div>
                  ) : (
                    <div className="profesores-asignados-list">
                      {profesoresAsignados.map((profesor) => (
                        <div key={profesor.asignacion_id} className="profesor-asignado-card">
                          <div className="profesor-asignado-info">
                            <div className="profesor-asignado-nombre">
                              {profesor.nombre}
                              <span className={`badge-status ${profesor.activo ? 'activo' : 'inactivo'}`}>
                                {profesor.activo ? '✓ Activo' : '✗ Inactivo'}
                              </span>
                            </div>
                            {profesor.rol && (
                              <span className="profesor-rol">Rol: {profesor.rol}</span>
                            )}
                          </div>
                          <button
                            className="btn btn-sm btn-danger"
                            onClick={() => eliminarAsignacion(profesor.asignacion_id, profesor.nombre)}
                            title="Quitar del evento"
                          >
                            🗑️ Quitar
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="evento-acciones-section">
                </div>

                <div className="tareas-evento-section">
                  <div className="tareas-evento-header">
                    <h4>✅ Tareas para Completar el Evento ({tareasEvento.filter(t => !t.completada).length} pendientes)</h4>
                    <button
                      className="btn btn-sm btn-primary"
                      onClick={() => setMostrarFormTarea(!mostrarFormTarea)}
                    >
                      {mostrarFormTarea ? '❌ Cancelar' : '➕ Agregar Tarea'}
                    </button>
                  </div>
                  
                  {mostrarFormTarea && (
                    <form className="form-tarea-evento" onSubmit={handleCrearTareaEvento}>
                      <input
                        type="text"
                        value={nuevaTareaDescripcion}
                        onChange={(e) => setNuevaTareaDescripcion(e.target.value)}
                        placeholder="Ej: Confirmar materiales, verificar horarios..."
                        className="input-tarea-evento"
                        autoFocus
                      />
                      <button type="submit" className="btn btn-sm btn-primary">
                        ➕ Agregar
                      </button>
                    </form>
                  )}

                  {cargandoTareas ? (
                    <div className="loading-tareas">
                      <Loading text="Cargando tareas..." size="small" />
                    </div>
                  ) : tareasEvento.length === 0 ? (
                    <div className="sin-tareas">
                      <p>No hay tareas registradas para este evento.</p>
                    </div>
                  ) : (
                    <div className="tareas-evento-list">
                      {tareasEvento.filter(t => !t.completada).map((tarea) => (
                        <div key={tarea.id} className="tarea-evento-item">
                          <div className="tarea-evento-content">
                            <input
                              type="checkbox"
                              checked={tarea.completada}
                              onChange={() => handleToggleTareaEvento(tarea.id)}
                              className="tarea-evento-checkbox"
                            />
                            <span className="tarea-evento-descripcion">{tarea.descripcion}</span>
                          </div>
                          <button
                            className="btn btn-sm btn-danger"
                            onClick={() => handleEliminarTareaEvento(tarea.id)}
                            title="Eliminar tarea"
                          >
                            🗑️
                          </button>
                        </div>
                      ))}
                      
                      {tareasEvento.filter(t => t.completada).length > 0 && (
                        <>
                          <div className="tareas-completadas-divider">
                            <h5>✅ Completadas ({tareasEvento.filter(t => t.completada).length})</h5>
                          </div>
                          {tareasEvento.filter(t => t.completada).map((tarea) => (
                            <div key={tarea.id} className="tarea-evento-item completada">
                              <div className="tarea-evento-content">
                                <input
                                  type="checkbox"
                                  checked={tarea.completada}
                                  onChange={() => handleToggleTareaEvento(tarea.id)}
                                  className="tarea-evento-checkbox"
                                />
                                <span className="tarea-evento-descripcion tachado">{tarea.descripcion}</span>
                                {tarea.completada_en && (
                                  <span className="tarea-completada-fecha">
                                    ✅ {new Date(tarea.completada_en).toLocaleDateString('es-ES')}
                                  </span>
                                )}
                              </div>
                              <button
                                className="btn btn-sm btn-danger"
                                onClick={() => handleEliminarTareaEvento(tarea.id)}
                                title="Eliminar tarea"
                              >
                                🗑️
                              </button>
                            </div>
                          ))}
                        </>
                      )}
                    </div>
                  )}
                </div>

                <div className="modal-actions">
                  <button
                    className="btn btn-secondary"
                    onClick={() => {
                      setEventoDetalle(null);
                      setProfesoresAsignados([]);
                      setTareasEvento([]);
                      setMostrarFormTarea(false);
                      setNuevaTareaDescripcion('');
                    }}
                  >
                    Cerrar
                  </button>
                  <button
                    className="btn btn-primary"
                    onClick={() => {
                      const eventoIdTemp = eventoDetalle.id;
                      setEventoDetalle(null);
                      setTareasEvento([]);
                      setMostrarFormTarea(false);
                      setNuevaTareaDescripcion('');
                      cargarProfesoresRecomendados(eventoIdTemp);
                    }}
                  >
                    👥 Asignar más Profesores
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}


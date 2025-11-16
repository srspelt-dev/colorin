import { useEffect, useState } from 'react';
import { usuariosAPI, authAPI } from '../api/client';
import Loading from '../components/Loading';
import './Usuarios.css';

export default function Usuarios() {
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    es_admin: false,
    activo: true,
  });
  const [error, setError] = useState('');

  useEffect(() => {
    cargarUsuarioActual();
    cargarUsuarios();
  }, []);

  const cargarUsuarioActual = async () => {
    try {
      const response = await authAPI.me();
      setCurrentUser(response.data);
    } catch (error) {
      console.error('Error cargando usuario actual:', error);
    }
  };

  const cargarUsuarios = async () => {
    try {
      setLoading(true);
      const response = await usuariosAPI.listar();
      setUsuarios(response.data);
    } catch (error) {
      console.error('Error cargando usuarios:', error);
      alert('Error al cargar usuarios');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    try {
      if (editingId) {
        const updateData = {
          username: formData.username,
          email: formData.email,
          activo: formData.activo,
          es_admin: formData.es_admin,
        };
        if (formData.password) {
          updateData.password = formData.password;
        }
        await usuariosAPI.actualizar(editingId, updateData);
      } else {
        await usuariosAPI.crear({
          username: formData.username,
          email: formData.email,
          password: formData.password,
          es_admin: formData.es_admin,
        });
      }

      setShowForm(false);
      setFormData({
        username: '',
        email: '',
        password: '',
        es_admin: false,
        activo: true,
      });
      setEditingId(null);
      cargarUsuarios();
    } catch (error) {
      console.error('Error guardando usuario:', error);
      setError(error.response?.data?.detail || 'Error al guardar el usuario');
    }
  };

  const handleEdit = (usuario) => {
    setFormData({
      username: usuario.username,
      email: usuario.email,
      password: '',
      es_admin: usuario.es_admin,
      activo: usuario.activo,
    });
    setEditingId(usuario.id);
    setShowForm(true);
    setError('');
  };

  const handleDelete = async (usuarioId, username) => {
    if (!confirm(`¿Estás seguro de eliminar al usuario "${username}"?`)) {
      return;
    }

    try {
      await usuariosAPI.eliminar(usuarioId);
      cargarUsuarios();
    } catch (error) {
      console.error('Error eliminando usuario:', error);
      alert(error.response?.data?.detail || 'Error al eliminar usuario');
    }
  };

  const toggleActivo = async (usuario) => {
    try {
      await usuariosAPI.actualizar(usuario.id, {
        activo: !usuario.activo,
      });
      cargarUsuarios();
    } catch (error) {
      console.error('Error cambiando estado:', error);
      alert('Error al cambiar el estado del usuario');
    }
  };

  if (loading) {
    return <Loading text="Cargando usuarios..." size="large" />;
  }

  const currentUserId = localStorage.getItem('username');
  const totalUsuarios = usuarios.length;
  const usuariosActivos = usuarios.filter(u => u.activo).length;
  const usuariosInactivos = usuarios.filter(u => !u.activo).length;
  const usuariosAdmin = usuarios.filter(u => u.es_admin).length;

  return (
    <div className="usuarios-page">
      <div className="page-header">
        <h2>👥 Usuarios del Sistema</h2>
        {currentUser?.es_admin && (
          <button
            className="btn btn-primary"
            onClick={() => {
              setShowForm(true);
              setFormData({
                username: '',
                email: '',
                password: '',
                es_admin: false,
                activo: true,
              });
              setEditingId(null);
              setError('');
            }}
          >
            ➕ Nuevo Usuario
          </button>
        )}
      </div>

      {/* Estadísticas */}
      <div className="usuarios-stats-container">
        <div className="stat-card">
          <div className="stat-icon">👥</div>
          <div className="stat-content">
            <div className="stat-label">Total de Usuarios</div>
            <div className="stat-number">{totalUsuarios}</div>
          </div>
        </div>
        <div className="stat-card success">
          <div className="stat-icon">✅</div>
          <div className="stat-content">
            <div className="stat-label">Activos</div>
            <div className="stat-number">{usuariosActivos}</div>
          </div>
        </div>
        <div className="stat-card secondary">
          <div className="stat-icon">⏸️</div>
          <div className="stat-content">
            <div className="stat-label">Inactivos</div>
            <div className="stat-number">{usuariosInactivos}</div>
          </div>
        </div>
        <div className="stat-card admin">
          <div className="stat-icon">👑</div>
          <div className="stat-content">
            <div className="stat-label">Administradores</div>
            <div className="stat-number">{usuariosAdmin}</div>
          </div>
        </div>
      </div>

      {/* Formulario */}
      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingId ? '✏️ Editar Usuario' : '➕ Nuevo Usuario'}</h3>
              <button className="close-btn" onClick={() => setShowForm(false)}>
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="form">
              {error && <div className="error-message">{error}</div>}

              <div className="form-group">
                <label>Usuario:</label>
                <input
                  type="text"
                  value={formData.username}
                  onChange={(e) =>
                    setFormData({ ...formData, username: e.target.value })
                  }
                  required
                  placeholder="Nombre de usuario"
                />
              </div>

              <div className="form-group">
                <label>Email:</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  required
                  placeholder="email@ejemplo.com"
                />
              </div>

              <div className="form-group">
                <label>
                  Contraseña {editingId && '(dejar vacío para no cambiar)'}:
                </label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) =>
                    setFormData({ ...formData, password: e.target.value })
                  }
                  required={!editingId}
                  placeholder="Contraseña"
                  minLength={6}
                />
              </div>

              <div className="form-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={formData.es_admin}
                    onChange={(e) =>
                      setFormData({ ...formData, es_admin: e.target.checked })
                    }
                  />
                  <span>Es Administrador</span>
                </label>
              </div>

              {editingId && (
                <div className="form-group">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={formData.activo}
                      onChange={(e) =>
                        setFormData({ ...formData, activo: e.target.checked })
                      }
                    />
                    <span>Usuario Activo</span>
                  </label>
                </div>
              )}

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowForm(false)}
                >
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingId ? '💾 Guardar Cambios' : '✅ Crear Usuario'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Lista de usuarios */}
      <div className="usuarios-list">
        {usuarios.length === 0 ? (
          <div className="sin-usuarios">
            <p>No hay usuarios registrados.</p>
          </div>
        ) : (
          usuarios.map((usuario) => (
            <div
              key={usuario.id}
              className={`usuario-card ${!usuario.activo ? 'inactivo' : ''} ${
                usuario.es_admin ? 'admin' : ''
              }`}
            >
              <div className="usuario-info">
                <div className="usuario-header">
                  <h3>{usuario.username}</h3>
                  <div className="usuario-badges">
                    {usuario.es_admin && (
                      <span className="badge badge-admin">👑 Admin</span>
                    )}
                    {usuario.activo ? (
                      <span className="badge badge-activo">✅ Activo</span>
                    ) : (
                      <span className="badge badge-inactivo">⏸️ Inactivo</span>
                    )}
                  </div>
                </div>
                <div className="usuario-details">
                  <p>
                    <strong>Email:</strong> {usuario.email}
                  </p>
                  <p>
                    <strong>Creado:</strong>{' '}
                    {new Date(usuario.creado_en).toLocaleDateString('es-ES', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </p>
                </div>
              </div>
              <div className="usuario-actions">
                {currentUser?.es_admin && (
                  <>
                    <button
                      className="btn btn-sm btn-secondary"
                      onClick={() => toggleActivo(usuario)}
                      title={usuario.activo ? 'Desactivar usuario' : 'Activar usuario'}
                    >
                      {usuario.activo ? '⏸️ Desactivar' : '▶️ Activar'}
                    </button>
                    <button
                      className="btn btn-sm btn-primary"
                      onClick={() => handleEdit(usuario)}
                    >
                      ✏️ Editar
                    </button>
                    {usuario.username !== currentUserId && (
                      <button
                        className="btn btn-sm btn-danger"
                        onClick={() => handleDelete(usuario.id, usuario.username)}
                      >
                        🗑️ Eliminar
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}


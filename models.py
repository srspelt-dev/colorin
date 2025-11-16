from datetime import datetime
from typing import Optional, Dict, Any
from bson import ObjectId
import database

# Nombres de las colecciones
COLLECTION_PROFESORES = "profesores"
COLLECTION_EVENTOS = "eventos"
COLLECTION_ASIGNACIONES = "asignaciones"
COLLECTION_USUARIOS = "usuarios"
COLLECTION_TAREAS = "tareas"
COLLECTION_TAREAS_EVENTO = "tareas_evento"


# Helper functions para trabajar con MongoDB
def get_collection(collection_name: str):
    """Obtener una colección de MongoDB"""
    db = database.get_database()
    return db[collection_name]


def create_indexes():
    """Crear índices en las colecciones"""
    try:
        db = database.get_database()
        
        # Índices para profesores
        db[COLLECTION_PROFESORES].create_index("nombre")
        db[COLLECTION_PROFESORES].create_index("activo")
        
        # Índices para eventos
        db[COLLECTION_EVENTOS].create_index("fecha")
        db[COLLECTION_EVENTOS].create_index("tipo")
        
        # Índices para asignaciones
        db[COLLECTION_ASIGNACIONES].create_index("profesor_id")
        db[COLLECTION_ASIGNACIONES].create_index("evento_id")
        try:
            db[COLLECTION_ASIGNACIONES].create_index([("profesor_id", 1), ("evento_id", 1)], unique=True)
        except Exception:
            pass  # El índice único puede fallar si ya existe o hay duplicados
        
        # Índices para usuarios
        db[COLLECTION_USUARIOS].create_index("username", unique=True)
        db[COLLECTION_USUARIOS].create_index("email", unique=True)
        
        # Índices para tareas
        db[COLLECTION_TAREAS].create_index("usuario_id")
        db[COLLECTION_TAREAS].create_index("completada")
        
        # Índices para tareas de evento
        db[COLLECTION_TAREAS_EVENTO].create_index("evento_id")
        db[COLLECTION_TAREAS_EVENTO].create_index("completada")
    except Exception as e:
        # Si hay un error de conexión, lo ignoramos y se intentará más tarde
        print(f"Warning: No se pudieron crear los índices: {e}")


# Clases helper para trabajar con documentos (similar a los modelos anteriores pero para MongoDB)
class Profesor:
    @staticmethod
    def create(nombre: str, activo: bool = True) -> Dict[str, Any]:
        """Crear un documento de profesor"""
        return {
            "nombre": nombre,
            "activo": activo
        }
    
    @staticmethod
    def to_dict(doc: Dict[str, Any]) -> Dict[str, Any]:
        """Convertir documento a dict con id como string"""
        doc["id"] = str(doc["_id"])
        del doc["_id"]
        return doc


class Evento:
    @staticmethod
    def create(nombre: str, fecha, tipo: str, ubicacion: Optional[str] = None,
               horario_colorin: Optional[str] = None, horario_cumpleanos: Optional[str] = None,
               actividad: Optional[list] = None, notas: Optional[str] = None,
               cantidad_profes: Optional[int] = 1) -> Dict[str, Any]:
        """Crear un documento de evento"""
        return {
            "nombre": nombre,
            "fecha": fecha,
            "tipo": tipo,
            "ubicacion": ubicacion,
            "horario_colorin": horario_colorin,
            "horario_cumpleanos": horario_cumpleanos,
            "actividad": actividad or [],
            "notas": notas,
            "cantidad_profes": cantidad_profes or 1
        }
    
    @staticmethod
    def to_dict(doc: Dict[str, Any]) -> Dict[str, Any]:
        """Convertir documento a dict con id como string"""
        doc["id"] = str(doc["_id"])
        del doc["_id"]
        return doc


class Asignacion:
    @staticmethod
    def create(profesor_id: str, evento_id: str, rol: str = "Profesor") -> Dict[str, Any]:
        """Crear un documento de asignación"""
        return {
            "profesor_id": profesor_id,
            "evento_id": evento_id,
            "rol": rol
        }
    
    @staticmethod
    def to_dict(doc: Dict[str, Any]) -> Dict[str, Any]:
        """Convertir documento a dict con id como string"""
        doc["id"] = str(doc["_id"])
        del doc["_id"]
        return doc


class Usuario:
    @staticmethod
    def create(username: str, email: str, hashed_password: str, activo: bool = True, es_admin: bool = True) -> Dict[str, Any]:
        """Crear un documento de usuario"""
        return {
            "username": username,
            "email": email,
            "hashed_password": hashed_password,
            "activo": activo,
            "es_admin": es_admin,
            "creado_en": datetime.utcnow()
        }
    
    @staticmethod
    def to_dict(doc: Dict[str, Any]) -> Dict[str, Any]:
        """Convertir documento a dict con id como string"""
        doc["id"] = str(doc["_id"])
        del doc["_id"]
        return doc


class Tarea:
    @staticmethod
    def create(usuario_id: str, titulo: str, descripcion: Optional[str] = None,
               fecha_vencimiento: Optional[Any] = None, prioridad: str = "media",
               completada: bool = False) -> Dict[str, Any]:
        """Crear un documento de tarea"""
        return {
            "usuario_id": usuario_id,
            "titulo": titulo,
            "descripcion": descripcion,
            "fecha_vencimiento": fecha_vencimiento,
            "prioridad": prioridad,
            "completada": completada,
            "creada_en": datetime.utcnow(),
            "completada_en": None
        }
    
    @staticmethod
    def to_dict(doc: Dict[str, Any]) -> Dict[str, Any]:
        """Convertir documento a dict con id como string"""
        doc["id"] = str(doc["_id"])
        del doc["_id"]
        return doc


class TareaEvento:
    @staticmethod
    def create(evento_id: str, descripcion: str, completada: bool = False) -> Dict[str, Any]:
        """Crear un documento de tarea de evento"""
        return {
            "evento_id": evento_id,
            "descripcion": descripcion,
            "completada": completada,
            "creada_en": datetime.utcnow(),
            "completada_en": None
        }
    
    @staticmethod
    def to_dict(doc: Dict[str, Any]) -> Dict[str, Any]:
        """Convertir documento a dict con id como string"""
        doc["id"] = str(doc["_id"])
        del doc["_id"]
        return doc

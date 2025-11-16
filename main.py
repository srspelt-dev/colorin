from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from typing import List, Optional
from datetime import date, datetime, timedelta
from pathlib import Path
from bson import ObjectId
import database
import models
import schemas
import auth
import json

app = FastAPI(
    title="Colorin - Gestión de Eventos",
    description="Sistema de gestión de eventos y asignación de profesores",
    version="1.0.0"
)

# Crear índices en MongoDB al iniciar (se hace de forma lazy para no bloquear el inicio)
@app.on_event("startup")
async def startup_event():
    """Crear índices al iniciar la aplicación"""
    models.create_indexes()

FRONTEND_DIST_PATH = Path(__file__).parent / "frontend_dist"
FRONTEND_INDEX_FILE = FRONTEND_DIST_PATH / "index.html"

if FRONTEND_DIST_PATH.exists():
    assets_dir = FRONTEND_DIST_PATH / "assets"
    if assets_dir.exists():
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")


def _serve_frontend_index():
    if FRONTEND_INDEX_FILE.exists():
        return FileResponse(FRONTEND_INDEX_FILE)
    return None

# Configurar CORS para permitir acceso desde cualquier origen (incluye celular)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ========== ENDPOINTS DE AUTENTICACIÓN ==========

@app.post("/login", response_model=schemas.Token)
def login(form_data: OAuth2PasswordRequestForm = Depends()):
    """Login de usuario"""
    user = auth.authenticate_user(form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario o contraseña incorrectos",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token_expires = timedelta(minutes=auth.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = auth.create_access_token(
        data={"sub": user.username}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}


@app.get("/usuarios/me", response_model=schemas.Usuario)
def read_users_me(current_user: models.Usuario = Depends(auth.get_current_active_admin)):
    """Obtener información del usuario actual"""
    return current_user


@app.put("/usuarios/me/cambiar-password")
def cambiar_password(
    cambio: schemas.CambiarPassword,
    current_user = Depends(auth.get_current_active_admin)
):
    """Cambiar la contraseña del usuario actual"""
    db = database.get_database()
    usuarios_collection = db[models.COLLECTION_USUARIOS]
    
    # Obtener el usuario desde la base de datos
    user_id = database.str_to_object_id(current_user.id)
    db_user = usuarios_collection.find_one({"_id": user_id})
    if not db_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Usuario no encontrado"
        )
    
    # Verificar que la contraseña actual sea correcta
    if not auth.verify_password(cambio.password_actual, db_user["hashed_password"]):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La contraseña actual es incorrecta"
        )
    
    # Validar que la nueva contraseña no esté vacía
    if not cambio.password_nueva or len(cambio.password_nueva.strip()) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La nueva contraseña no puede estar vacía"
        )
    
    # Hashear y actualizar la contraseña
    usuarios_collection.update_one(
        {"_id": user_id},
        {"$set": {"hashed_password": auth.get_password_hash(cambio.password_nueva)}}
    )
    
    return {"message": "Contraseña actualizada correctamente"}


@app.post("/usuarios/", response_model=schemas.Usuario)
def create_user(usuario: schemas.UsuarioCreate):
    """Crear nuevo usuario (solo para configuración inicial - solo si no hay usuarios)"""
    db = database.get_database()
    usuarios_collection = db[models.COLLECTION_USUARIOS]
    
    # Verificar si ya existe un usuario
    existing_user = usuarios_collection.find_one()
    if existing_user:
        raise HTTPException(
            status_code=400,
            detail="Ya existe un usuario. Usa el endpoint /login para acceder."
        )
    
    # Verificar si el username ya existe
    db_user = usuarios_collection.find_one({"username": usuario.username})
    if db_user:
        raise HTTPException(status_code=400, detail="El usuario ya existe")
    
    # Verificar si el email ya existe
    db_email = usuarios_collection.find_one({"email": usuario.email})
    if db_email:
        raise HTTPException(status_code=400, detail="El email ya está registrado")
    
    hashed_password = auth.get_password_hash(usuario.password)
    user_doc = models.Usuario.create(
        username=usuario.username,
        email=usuario.email,
        hashed_password=hashed_password,
        activo=True,
        es_admin=True
    )
    result = usuarios_collection.insert_one(user_doc)
    user_doc["_id"] = result.inserted_id
    return models.Usuario.to_dict(user_doc)


@app.get("/")
def root():
    index_response = _serve_frontend_index()
    if index_response:
        return index_response
    return {
        "message": "API de Colorin - Gestión de Eventos",
        "version": "1.0.0"
    }


# ========== ENDPOINTS DE PROFESORES ==========

@app.post("/profesores/", response_model=schemas.Profesor)
def crear_profesor(
    profesor: schemas.ProfesorCreate,
    current_user = Depends(auth.get_current_active_admin)
):
    """Crear un nuevo profesor"""
    db = database.get_database()
    profesores_collection = db[models.COLLECTION_PROFESORES]
    
    profesor_doc = models.Profesor.create(nombre=profesor.nombre, activo=profesor.activo)
    result = profesores_collection.insert_one(profesor_doc)
    profesor_doc["_id"] = result.inserted_id
    return models.Profesor.to_dict(profesor_doc)


@app.get("/profesores/", response_model=List[schemas.Profesor])
def listar_profesores(
    activo: Optional[bool] = None,
    current_user = Depends(auth.get_current_active_admin)
):
    """Listar todos los profesores, opcionalmente filtrar por activos"""
    db = database.get_database()
    profesores_collection = db[models.COLLECTION_PROFESORES]
    
    query = {}
    if activo is not None:
        query["activo"] = activo
    
    profesores = list(profesores_collection.find(query))
    return [models.Profesor.to_dict(p) for p in profesores]


@app.get("/profesores/{profesor_id}", response_model=schemas.Profesor)
def obtener_profesor(
    profesor_id: str,
    current_user = Depends(auth.get_current_active_admin)
):
    """Obtener un profesor por ID"""
    db = database.get_database()
    profesores_collection = db[models.COLLECTION_PROFESORES]
    
    profesor_id_obj = database.str_to_object_id(profesor_id)
    profesor = profesores_collection.find_one({"_id": profesor_id_obj})
    if not profesor:
        raise HTTPException(status_code=404, detail="Profesor no encontrado")
    return models.Profesor.to_dict(profesor)


@app.put("/profesores/{profesor_id}", response_model=schemas.Profesor)
def actualizar_profesor(
    profesor_id: str,
    profesor: schemas.ProfesorUpdate,
    current_user = Depends(auth.get_current_active_admin)
):
    """Actualizar un profesor"""
    db = database.get_database()
    profesores_collection = db[models.COLLECTION_PROFESORES]
    
    profesor_id_obj = database.str_to_object_id(profesor_id)
    db_profesor = profesores_collection.find_one({"_id": profesor_id_obj})
    if not db_profesor:
        raise HTTPException(status_code=404, detail="Profesor no encontrado")
    
    update_data = {}
    if profesor.nombre is not None:
        update_data["nombre"] = profesor.nombre
    if profesor.activo is not None:
        update_data["activo"] = profesor.activo
    
    if update_data:
        profesores_collection.update_one({"_id": profesor_id_obj}, {"$set": update_data})
        db_profesor.update(update_data)
    
    return models.Profesor.to_dict(db_profesor)


@app.delete("/profesores/{profesor_id}")
def eliminar_profesor(
    profesor_id: str,
    current_user = Depends(auth.get_current_active_admin)
):
    """Eliminar un profesor (solo si no tiene eventos asignados)"""
    db = database.get_database()
    profesores_collection = db[models.COLLECTION_PROFESORES]
    asignaciones_collection = db[models.COLLECTION_ASIGNACIONES]
    
    profesor_id_obj = database.str_to_object_id(profesor_id)
    db_profesor = profesores_collection.find_one({"_id": profesor_id_obj})
    if not db_profesor:
        raise HTTPException(status_code=404, detail="Profesor no encontrado")
    
    # Verificar si tiene eventos asignados
    asignaciones = asignaciones_collection.count_documents({"profesor_id": profesor_id})
    if asignaciones > 0:
        raise HTTPException(
            status_code=400, 
            detail=f"No se puede eliminar el profesor. Tiene {asignaciones} eventos asignados."
        )
    
    profesores_collection.delete_one({"_id": profesor_id_obj})
    return {"message": "Profesor eliminado correctamente"}


# ========== ENDPOINTS DE EVENTOS ==========

@app.post("/eventos/", response_model=schemas.Evento)
def crear_evento(
    evento: schemas.EventoCreate,
    current_user = Depends(auth.get_current_active_admin)
):
    """Crear un nuevo evento"""
    db = database.get_database()
    eventos_collection = db[models.COLLECTION_EVENTOS]
    
    # Convertir fecha a string si es un objeto date
    fecha_str = evento.fecha.isoformat() if isinstance(evento.fecha, date) else evento.fecha
    
    evento_doc = models.Evento.create(
        nombre=evento.nombre,
        fecha=fecha_str,
        tipo=evento.tipo,
        ubicacion=evento.ubicacion,
        horario_colorin=evento.horario_colorin,
        horario_cumpleanos=evento.horario_cumpleanos,
        actividad=evento.actividad,
        notas=evento.notas,
        cantidad_profes=evento.cantidad_profes
    )
    result = eventos_collection.insert_one(evento_doc)
    evento_doc["_id"] = result.inserted_id
    return models.Evento.to_dict(evento_doc)


@app.get("/eventos/", response_model=List[schemas.Evento])
def listar_eventos(
    fecha_desde: Optional[date] = None,
    fecha_hasta: Optional[date] = None,
    tipo: Optional[str] = None,
    current_user = Depends(auth.get_current_active_admin)
):
    """Listar eventos con filtros opcionales"""
    db = database.get_database()
    eventos_collection = db[models.COLLECTION_EVENTOS]
    
    query = {}
    if fecha_desde:
        query["fecha"] = {"$gte": fecha_desde}
    if fecha_hasta:
        if "fecha" in query:
            query["fecha"]["$lte"] = fecha_hasta
        else:
            query["fecha"] = {"$lte": fecha_hasta}
    if tipo:
        query["tipo"] = tipo
    
    eventos = list(eventos_collection.find(query).sort("fecha", 1))
    return [models.Evento.to_dict(e) for e in eventos]


@app.get("/eventos/{evento_id}", response_model=schemas.Evento)
def obtener_evento(evento_id: str, current_user = Depends(auth.get_current_active_admin)):
    """Obtener un evento por ID con sus asignaciones"""
    db = database.get_database()
    eventos_collection = db[models.COLLECTION_EVENTOS]
    
    evento_id_obj = database.str_to_object_id(evento_id)
    evento = eventos_collection.find_one({"_id": evento_id_obj})
    if not evento:
        raise HTTPException(status_code=404, detail="Evento no encontrado")
    return models.Evento.to_dict(evento)


@app.put("/eventos/{evento_id}", response_model=schemas.Evento)
def actualizar_evento(evento_id: str, evento: schemas.EventoUpdate, current_user = Depends(auth.get_current_active_admin)):
    """Actualizar un evento"""
    db = database.get_database()
    eventos_collection = db[models.COLLECTION_EVENTOS]
    
    evento_id_obj = database.str_to_object_id(evento_id)
    db_evento = eventos_collection.find_one({"_id": evento_id_obj})
    if not db_evento:
        raise HTTPException(status_code=404, detail="Evento no encontrado")
    
    update_data = {}
    if evento.nombre is not None:
        update_data["nombre"] = evento.nombre
    if evento.fecha is not None:
        # Convertir fecha a string si es un objeto date
        fecha_str = evento.fecha.isoformat() if isinstance(evento.fecha, date) else evento.fecha
        update_data["fecha"] = fecha_str
    if evento.tipo is not None:
        update_data["tipo"] = evento.tipo
    if evento.ubicacion is not None:
        update_data["ubicacion"] = evento.ubicacion
    if evento.horario_colorin is not None:
        update_data["horario_colorin"] = evento.horario_colorin
    if evento.horario_cumpleanos is not None:
        update_data["horario_cumpleanos"] = evento.horario_cumpleanos
    if evento.actividad is not None:
        update_data["actividad"] = evento.actividad or []
    if evento.notas is not None:
        update_data["notas"] = evento.notas
    if evento.cantidad_profes is not None:
        update_data["cantidad_profes"] = evento.cantidad_profes
    
    if update_data:
        eventos_collection.update_one({"_id": evento_id_obj}, {"$set": update_data})
        db_evento.update(update_data)
    
    return models.Evento.to_dict(db_evento)


@app.delete("/eventos/{evento_id}")
def eliminar_evento(evento_id: str, current_user = Depends(auth.get_current_active_admin)):
    """Eliminar un evento y sus asignaciones"""
    db = database.get_database()
    eventos_collection = db[models.COLLECTION_EVENTOS]
    asignaciones_collection = db[models.COLLECTION_ASIGNACIONES]
    
    evento_id_obj = database.str_to_object_id(evento_id)
    db_evento = eventos_collection.find_one({"_id": evento_id_obj})
    if not db_evento:
        raise HTTPException(status_code=404, detail="Evento no encontrado")
    
    # Eliminar asignaciones asociadas
    asignaciones_collection.delete_many({"evento_id": evento_id})
    
    eventos_collection.delete_one({"_id": evento_id_obj})
    return {"message": "Evento eliminado correctamente"}


# ========== ENDPOINTS DE ASIGNACIONES ==========

@app.post("/asignaciones/", response_model=schemas.Asignacion)
def crear_asignacion(asignacion: schemas.AsignacionCreate, current_user = Depends(auth.get_current_active_admin)):
    """Asignar un profesor a un evento"""
    db = database.get_database()
    profesores_collection = db[models.COLLECTION_PROFESORES]
    eventos_collection = db[models.COLLECTION_EVENTOS]
    asignaciones_collection = db[models.COLLECTION_ASIGNACIONES]
    
    # Verificar que el profesor existe
    profesor_id_obj = database.str_to_object_id(asignacion.profesor_id)
    profesor = profesores_collection.find_one({"_id": profesor_id_obj})
    if not profesor:
        raise HTTPException(status_code=404, detail="Profesor no encontrado")
    
    # Verificar que el evento existe
    evento_id_obj = database.str_to_object_id(asignacion.evento_id)
    evento = eventos_collection.find_one({"_id": evento_id_obj})
    if not evento:
        raise HTTPException(status_code=404, detail="Evento no encontrado")
    
    # Verificar que no esté ya asignado
    existe = asignaciones_collection.find_one({
        "profesor_id": asignacion.profesor_id,
        "evento_id": asignacion.evento_id
    })
    
    if existe:
        raise HTTPException(status_code=400, detail="El profesor ya está asignado a este evento")
    
    asignacion_doc = models.Asignacion.create(
        profesor_id=asignacion.profesor_id,
        evento_id=asignacion.evento_id,
        rol=asignacion.rol
    )
    result = asignaciones_collection.insert_one(asignacion_doc)
    asignacion_doc["_id"] = result.inserted_id
    return models.Asignacion.to_dict(asignacion_doc)


@app.get("/asignaciones/", response_model=List[schemas.Asignacion])
def listar_asignaciones(
    profesor_id: Optional[str] = None,
    evento_id: Optional[str] = None,
    current_user = Depends(auth.get_current_active_admin)
):
    """Listar asignaciones con filtros opcionales"""
    db = database.get_database()
    asignaciones_collection = db[models.COLLECTION_ASIGNACIONES]
    
    query = {}
    if profesor_id:
        query["profesor_id"] = profesor_id
    if evento_id:
        query["evento_id"] = evento_id
    
    asignaciones = list(asignaciones_collection.find(query))
    return [models.Asignacion.to_dict(a) for a in asignaciones]


@app.delete("/asignaciones/{asignacion_id}")
def eliminar_asignacion(asignacion_id: str, current_user = Depends(auth.get_current_active_admin)):
    """Eliminar una asignación"""
    db = database.get_database()
    asignaciones_collection = db[models.COLLECTION_ASIGNACIONES]
    
    asignacion_id_obj = database.str_to_object_id(asignacion_id)
    db_asignacion = asignaciones_collection.find_one({"_id": asignacion_id_obj})
    if not db_asignacion:
        raise HTTPException(status_code=404, detail="Asignación no encontrada")
    
    asignaciones_collection.delete_one({"_id": asignacion_id_obj})
    return {"message": "Asignación eliminada correctamente"}


@app.post("/asignaciones/multiples")
def crear_asignaciones_multiples(asignaciones: List[schemas.AsignacionCreate], current_user = Depends(auth.get_current_active_admin)):
    """Asignar múltiples profesores a eventos"""
    db = database.get_database()
    profesores_collection = db[models.COLLECTION_PROFESORES]
    eventos_collection = db[models.COLLECTION_EVENTOS]
    asignaciones_collection = db[models.COLLECTION_ASIGNACIONES]
    
    asignaciones_creadas = []
    errores = []
    
    for asignacion_data in asignaciones:
        try:
            # Verificar que el profesor existe
            profesor_id_obj = database.str_to_object_id(asignacion_data.profesor_id)
            profesor = profesores_collection.find_one({"_id": profesor_id_obj})
            if not profesor:
                errores.append(f"Profesor {asignacion_data.profesor_id} no encontrado")
                continue
            
            # Verificar que el evento existe
            evento_id_obj = database.str_to_object_id(asignacion_data.evento_id)
            evento = eventos_collection.find_one({"_id": evento_id_obj})
            if not evento:
                errores.append(f"Evento {asignacion_data.evento_id} no encontrado")
                continue
            
            # Verificar que no esté ya asignado
            existe = asignaciones_collection.find_one({
                "profesor_id": asignacion_data.profesor_id,
                "evento_id": asignacion_data.evento_id
            })
            
            if existe:
                errores.append(f"El profesor {profesor['nombre']} ya está asignado a este evento")
                continue
            
            asignacion_doc = models.Asignacion.create(
                profesor_id=asignacion_data.profesor_id,
                evento_id=asignacion_data.evento_id,
                rol=asignacion_data.rol
            )
            asignaciones_collection.insert_one(asignacion_doc)
            asignaciones_creadas.append({
                "profesor_id": str(profesor["_id"]),
                "profesor_nombre": profesor["nombre"],
                "evento_id": str(evento["_id"])
            })
        except Exception as e:
            errores.append(f"Error al asignar profesor {asignacion_data.profesor_id}: {str(e)}")
    
    return {
        "asignaciones_creadas": asignaciones_creadas,
        "total_creadas": len(asignaciones_creadas),
        "errores": errores if errores else None
    }


# ========== RECOMENDACIONES Y ASIGNACIÓN MANUAL ==========

@app.get("/eventos/{evento_id}/profesores-recomendados")
def obtener_profesores_recomendados(evento_id: str, current_user = Depends(auth.get_current_active_admin)):
    """Obtener lista de profesores recomendados para un evento, ordenados por cantidad de eventos (menos eventos primero)"""
    db = database.get_database()
    eventos_collection = db[models.COLLECTION_EVENTOS]
    profesores_collection = db[models.COLLECTION_PROFESORES]
    asignaciones_collection = db[models.COLLECTION_ASIGNACIONES]
    
    # Verificar que el evento existe
    evento_id_obj = database.str_to_object_id(evento_id)
    evento = eventos_collection.find_one({"_id": evento_id_obj})
    if not evento:
        raise HTTPException(status_code=404, detail="Evento no encontrado")
    
    # Obtener profesores ya asignados a este evento
    asignados = list(asignaciones_collection.find({"evento_id": evento_id}))
    asignados_ids = [a["profesor_id"] for a in asignados]
    
    # Obtener todos los profesores activos
    todos_profesores = list(profesores_collection.find({"activo": True}))
    
    # Obtener conteo de eventos futuros por profesor
    hoy = date.today().isoformat()  # Convertir a string formato ISO
    eventos_futuros = list(eventos_collection.find({"fecha": {"$gte": hoy}}))
    eventos_futuros_ids = [str(e["_id"]) for e in eventos_futuros]
    
    # Contar asignaciones futuras por profesor
    conteos_dict = {}
    for profesor in todos_profesores:
        prof_id = str(profesor["_id"])
        conteos_dict[prof_id] = asignaciones_collection.count_documents({
            "profesor_id": prof_id,
            "evento_id": {"$in": eventos_futuros_ids}
        })
    
    # Preparar la lista de recomendados
    recomendados = []
    for profesor in todos_profesores:
        prof_id = str(profesor["_id"])
        total_eventos = conteos_dict.get(prof_id, 0)
        ya_asignado = prof_id in asignados_ids
        
        recomendados.append({
            "profesor_id": prof_id,
            "nombre": profesor["nombre"],
            "total_eventos_futuros": total_eventos,
            "ya_asignado": ya_asignado,
            "recomendado": not ya_asignado
        })
    
    # Ordenar: primero los no asignados, luego por cantidad de eventos (menos eventos primero)
    recomendados.sort(key=lambda x: (x["ya_asignado"], x["total_eventos_futuros"], x["nombre"]))
    
    return {
        "evento_id": evento_id,
        "evento_nombre": evento["nombre"],
        "evento_fecha": evento["fecha"],
        "profesores": recomendados,
        "total_profesores": len(recomendados),
        "profesores_disponibles": len([p for p in recomendados if not p["ya_asignado"]])
    }


# ========== ASIGNACIÓN AUTOMÁTICA EQUITATIVA ==========

@app.post("/eventos/{evento_id}/asignar-automatico")
def asignar_automatico(evento_id: str, cantidad_profes: int, current_user = Depends(auth.get_current_active_admin)):
    """Asignar profesores a un evento de manera equitativa"""
    db = database.get_database()
    eventos_collection = db[models.COLLECTION_EVENTOS]
    profesores_collection = db[models.COLLECTION_PROFESORES]
    asignaciones_collection = db[models.COLLECTION_ASIGNACIONES]
    
    # Verificar que el evento existe
    evento_id_obj = database.str_to_object_id(evento_id)
    evento = eventos_collection.find_one({"_id": evento_id_obj})
    if not evento:
        raise HTTPException(status_code=404, detail="Evento no encontrado")
    
    # Obtener profesores activos
    profesores_activos = list(profesores_collection.find({"activo": True}))
    if not profesores_activos:
        raise HTTPException(status_code=400, detail="No hay profesores activos")
    
    if cantidad_profes > len(profesores_activos):
        raise HTTPException(
            status_code=400,
            detail=f"Solo hay {len(profesores_activos)} profesores activos, pero se solicitan {cantidad_profes}"
        )
    
    # Obtener conteo de eventos futuros por profesor
    hoy = date.today().isoformat()  # Convertir a string formato ISO
    eventos_futuros = list(eventos_collection.find({"fecha": {"$gte": hoy}}))
    eventos_futuros_ids = [str(e["_id"]) for e in eventos_futuros]
    
    # Contar asignaciones futuras por profesor
    conteos_dict = {}
    for profesor in profesores_activos:
        prof_id = str(profesor["_id"])
        conteos_dict[prof_id] = asignaciones_collection.count_documents({
            "profesor_id": prof_id,
            "evento_id": {"$in": eventos_futuros_ids}
        })
    
    # Ordenar profesores por cantidad de eventos (menos eventos primero)
    profesores_ordenados = sorted(
        profesores_activos,
        key=lambda p: (conteos_dict.get(str(p["_id"]), 0), str(p["_id"]))
    )
    
    # Seleccionar los primeros N profesores
    profesores_seleccionados = profesores_ordenados[:cantidad_profes]
    
    # Crear asignaciones
    asignaciones_creadas = []
    for profesor in profesores_seleccionados:
        prof_id = str(profesor["_id"])
        # Verificar que no esté ya asignado
        existe = asignaciones_collection.find_one({
            "profesor_id": prof_id,
            "evento_id": evento_id
        })
        
        if not existe:
            asignacion_doc = models.Asignacion.create(
                profesor_id=prof_id,
                evento_id=evento_id,
                rol="Profesor"
            )
            asignaciones_collection.insert_one(asignacion_doc)
            asignaciones_creadas.append({
                "profesor_id": prof_id,
                "profesor_nombre": profesor["nombre"]
            })
    
    return {
        "message": f"Se asignaron {len(asignaciones_creadas)} profesores al evento",
        "asignaciones": asignaciones_creadas
    }


# ========== ENDPOINTS DE REPORTES ==========

@app.get("/reportes/estadisticas-profesores")
def estadisticas_profesores(
    fecha_desde: Optional[date] = None,
    fecha_hasta: Optional[date] = None,
    current_user = Depends(auth.get_current_active_admin)
):
    """Obtener estadísticas de eventos por profesor"""
    db = database.get_database()
    profesores_collection = db[models.COLLECTION_PROFESORES]
    asignaciones_collection = db[models.COLLECTION_ASIGNACIONES]
    eventos_collection = db[models.COLLECTION_EVENTOS]
    
    # Obtener todos los profesores
    profesores = list(profesores_collection.find().sort("nombre", 1))
    
    # Construir filtro de eventos si hay fechas
    evento_filter = {}
    if fecha_desde or fecha_hasta:
        fecha_filter = {}
        if fecha_desde:
            fecha_filter["$gte"] = fecha_desde
        if fecha_hasta:
            fecha_filter["$lte"] = fecha_hasta
        evento_filter["fecha"] = fecha_filter
    
    eventos = list(eventos_collection.find(evento_filter))
    eventos_ids = [str(e["_id"]) for e in eventos]
    
    estadisticas = []
    for profesor in profesores:
        prof_id = str(profesor["_id"])
        # Contar asignaciones para este profesor en eventos filtrados
        total = asignaciones_collection.count_documents({
            "profesor_id": prof_id,
            "evento_id": {"$in": eventos_ids}
        })
        
        estadisticas.append({
            "profesor_id": prof_id,
            "nombre": profesor["nombre"],
            "activo": profesor.get("activo", True),
            "total_eventos": total
        })
    
    # Calcular estadísticas generales
    total_eventos = sum(stat['total_eventos'] for stat in estadisticas)
    promedio = total_eventos / len(estadisticas) if estadisticas else 0
    
    return {
        "estadisticas": estadisticas,
        "resumen": {
            "total_profesores": len(estadisticas),
            "total_eventos_asignados": total_eventos,
            "promedio_eventos_por_profesor": round(promedio, 2)
        }
    }


@app.get("/reportes/eventos-por-profe/{profesor_id}")
def eventos_por_profesor(
    profesor_id: str,
    fecha_desde: Optional[date] = None,
    fecha_hasta: Optional[date] = None,
    current_user = Depends(auth.get_current_active_admin)
):
    """Obtener todos los eventos de un profesor específico"""
    db = database.get_database()
    profesores_collection = db[models.COLLECTION_PROFESORES]
    asignaciones_collection = db[models.COLLECTION_ASIGNACIONES]
    eventos_collection = db[models.COLLECTION_EVENTOS]
    
    profesor_id_obj = database.str_to_object_id(profesor_id)
    profesor = profesores_collection.find_one({"_id": profesor_id_obj})
    if not profesor:
        raise HTTPException(status_code=404, detail="Profesor no encontrado")
    
    # Obtener asignaciones del profesor
    asignaciones = list(asignaciones_collection.find({"profesor_id": profesor_id}))
    eventos_ids = [a["evento_id"] for a in asignaciones]
    
    # Construir filtro de eventos
    evento_filter = {"_id": {"$in": [database.str_to_object_id(eid) for eid in eventos_ids]}}
    if fecha_desde or fecha_hasta:
        fecha_filter = {}
        if fecha_desde:
            fecha_filter["$gte"] = fecha_desde
        if fecha_hasta:
            fecha_filter["$lte"] = fecha_hasta
        evento_filter["fecha"] = fecha_filter
    
    eventos = list(eventos_collection.find(evento_filter).sort("fecha", 1))
    
    eventos_data = []
    asignaciones_dict = {a["evento_id"]: a for a in asignaciones}
    for evento in eventos:
        evento_id_str = str(evento["_id"])
        asignacion = asignaciones_dict.get(evento_id_str)
        
        eventos_data.append({
            "evento_id": evento_id_str,
            "nombre": evento["nombre"],
            "fecha": evento["fecha"],
            "tipo": evento["tipo"],
            "ubicacion": evento.get("ubicacion"),
            "rol": asignacion["rol"] if asignacion else None
        })
    
    return {
        "profesor": {
            "id": profesor_id,
            "nombre": profesor["nombre"],
            "activo": profesor.get("activo", True)
        },
        "total_eventos": len(eventos_data),
        "eventos": eventos_data
    }


@app.get("/reportes/distribucion-equitativa")
def distribucion_equitativa(current_user = Depends(auth.get_current_active_admin)):
    """Mostrar la distribución actual de eventos entre profesores activos"""
    db = database.get_database()
    profesores_collection = db[models.COLLECTION_PROFESORES]
    asignaciones_collection = db[models.COLLECTION_ASIGNACIONES]
    eventos_collection = db[models.COLLECTION_EVENTOS]
    
    # Obtener solo eventos futuros (convertir a string para comparar con MongoDB)
    hoy = date.today().isoformat()  # Convertir a string formato ISO (YYYY-MM-DD)
    eventos_futuros = list(eventos_collection.find({"fecha": {"$gte": hoy}}))
    eventos_futuros_ids = [str(e["_id"]) for e in eventos_futuros]
    
    # Obtener profesores activos
    profesores = list(profesores_collection.find({"activo": True}))
    
    distribucion = []
    for profesor in profesores:
        prof_id = str(profesor["_id"])
        total = asignaciones_collection.count_documents({
            "profesor_id": prof_id,
            "evento_id": {"$in": eventos_futuros_ids}
        })
        
        distribucion.append({
            "profesor_id": prof_id,
            "nombre": profesor["nombre"],
            "total_eventos_futuros": total
        })
    
    # Ordenar por total de eventos
    distribucion.sort(key=lambda x: x["total_eventos_futuros"])
    
    if distribucion:
        min_eventos = min(d['total_eventos_futuros'] for d in distribucion)
        max_eventos = max(d['total_eventos_futuros'] for d in distribucion)
        diferencia = max_eventos - min_eventos
        
        return {
            "distribucion": distribucion,
            "analisis": {
                "minimo_eventos": min_eventos,
                "maximo_eventos": max_eventos,
                "diferencia": diferencia,
                "es_equitativo": diferencia <= 1
            }
        }
    
    return {
        "distribucion": [],
        "analisis": {
            "mensaje": "No hay eventos futuros asignados"
        }
    }


# ========== ENDPOINTS DE TAREAS ==========

@app.post("/tareas/", response_model=schemas.Tarea)
def crear_tarea(
    tarea: schemas.TareaCreate,
    current_user = Depends(auth.get_current_active_admin)
):
    """Crear una nueva tarea para el usuario actual"""
    db = database.get_database()
    tareas_collection = db[models.COLLECTION_TAREAS]
    
    tarea_doc = models.Tarea.create(
        usuario_id=current_user.id,
        titulo=tarea.titulo,
        descripcion=tarea.descripcion,
        fecha_vencimiento=tarea.fecha_vencimiento,
        prioridad=tarea.prioridad,
        completada=False
    )
    result = tareas_collection.insert_one(tarea_doc)
    tarea_doc["_id"] = result.inserted_id
    return models.Tarea.to_dict(tarea_doc)


@app.get("/tareas/", response_model=List[schemas.Tarea])
def listar_tareas(
    completada: Optional[bool] = None,
    prioridad: Optional[str] = None,
    current_user = Depends(auth.get_current_active_admin)
):
    """Listar tareas del usuario actual con filtros opcionales"""
    db = database.get_database()
    tareas_collection = db[models.COLLECTION_TAREAS]
    
    query = {"usuario_id": current_user.id}
    if completada is not None:
        query["completada"] = completada
    if prioridad:
        query["prioridad"] = prioridad
    
    tareas = list(tareas_collection.find(query).sort([
        ("fecha_vencimiento", 1),
        ("prioridad", -1),
        ("creada_en", -1)
    ]))
    
    return [models.Tarea.to_dict(t) for t in tareas]


@app.get("/tareas/{tarea_id}", response_model=schemas.Tarea)
def obtener_tarea(
    tarea_id: str,
    current_user = Depends(auth.get_current_active_admin)
):
    """Obtener una tarea por ID del usuario actual"""
    db = database.get_database()
    tareas_collection = db[models.COLLECTION_TAREAS]
    
    tarea_id_obj = database.str_to_object_id(tarea_id)
    tarea = tareas_collection.find_one({
        "_id": tarea_id_obj,
        "usuario_id": current_user.id
    })
    if not tarea:
        raise HTTPException(status_code=404, detail="Tarea no encontrada")
    return models.Tarea.to_dict(tarea)


@app.put("/tareas/{tarea_id}", response_model=schemas.Tarea)
def actualizar_tarea(
    tarea_id: str,
    tarea: schemas.TareaUpdate,
    current_user = Depends(auth.get_current_active_admin)
):
    """Actualizar una tarea del usuario actual"""
    db = database.get_database()
    tareas_collection = db[models.COLLECTION_TAREAS]
    
    tarea_id_obj = database.str_to_object_id(tarea_id)
    db_tarea = tareas_collection.find_one({
        "_id": tarea_id_obj,
        "usuario_id": current_user.id
    })
    if not db_tarea:
        raise HTTPException(status_code=404, detail="Tarea no encontrada")
    
    # Actualizar solo los campos proporcionados
    update_data = tarea.model_dump(exclude_unset=True)
    if "completada" in update_data:
        if update_data["completada"] and not db_tarea.get("completada", False):
            update_data["completada_en"] = datetime.utcnow()
        elif not update_data["completada"]:
            update_data["completada_en"] = None
    
    if update_data:
        tareas_collection.update_one(
            {"_id": tarea_id_obj},
            {"$set": update_data}
        )
        db_tarea.update(update_data)
    
    return models.Tarea.to_dict(db_tarea)


@app.delete("/tareas/{tarea_id}")
def eliminar_tarea(
    tarea_id: str,
    current_user = Depends(auth.get_current_active_admin)
):
    """Eliminar una tarea del usuario actual"""
    db = database.get_database()
    tareas_collection = db[models.COLLECTION_TAREAS]
    
    tarea_id_obj = database.str_to_object_id(tarea_id)
    db_tarea = tareas_collection.find_one({
        "_id": tarea_id_obj,
        "usuario_id": current_user.id
    })
    if not db_tarea:
        raise HTTPException(status_code=404, detail="Tarea no encontrada")
    
    tareas_collection.delete_one({"_id": tarea_id_obj})
    return {"message": "Tarea eliminada correctamente"}


@app.patch("/tareas/{tarea_id}/toggle")
def toggle_tarea(
    tarea_id: str,
    current_user = Depends(auth.get_current_active_admin)
):
    """Alternar el estado de completada de una tarea del usuario actual"""
    db = database.get_database()
    tareas_collection = db[models.COLLECTION_TAREAS]
    
    tarea_id_obj = database.str_to_object_id(tarea_id)
    db_tarea = tareas_collection.find_one({
        "_id": tarea_id_obj,
        "usuario_id": current_user.id
    })
    if not db_tarea:
        raise HTTPException(status_code=404, detail="Tarea no encontrada")
    
    nueva_completada = not db_tarea.get("completada", False)
    update_data = {"completada": nueva_completada}
    if nueva_completada:
        update_data["completada_en"] = datetime.utcnow()
    else:
        update_data["completada_en"] = None
    
    tareas_collection.update_one({"_id": tarea_id_obj}, {"$set": update_data})
    db_tarea.update(update_data)
    return models.Tarea.to_dict(db_tarea)


# ========== ENDPOINTS DE TAREAS DE EVENTO ==========

@app.post("/eventos/{evento_id}/tareas", response_model=schemas.TareaEvento)
def crear_tarea_evento(
    evento_id: str,
    tarea: schemas.TareaEventoBase,
    current_user = Depends(auth.get_current_active_admin)
):
    """Crear una nueva tarea para un evento"""
    db = database.get_database()
    eventos_collection = db[models.COLLECTION_EVENTOS]
    tareas_evento_collection = db[models.COLLECTION_TAREAS_EVENTO]
    
    # Verificar que el evento existe
    evento_id_obj = database.str_to_object_id(evento_id)
    evento = eventos_collection.find_one({"_id": evento_id_obj})
    if not evento:
        raise HTTPException(status_code=404, detail="Evento no encontrado")
    
    tarea_doc = models.TareaEvento.create(
        evento_id=evento_id,
        descripcion=tarea.descripcion,
        completada=False
    )
    result = tareas_evento_collection.insert_one(tarea_doc)
    tarea_doc["_id"] = result.inserted_id
    return models.TareaEvento.to_dict(tarea_doc)


@app.get("/eventos/{evento_id}/tareas", response_model=List[schemas.TareaEvento])
def listar_tareas_evento(
    evento_id: str,
    completada: Optional[bool] = None,
    current_user = Depends(auth.get_current_active_admin)
):
    """Listar tareas de un evento con filtros opcionales"""
    db = database.get_database()
    eventos_collection = db[models.COLLECTION_EVENTOS]
    tareas_evento_collection = db[models.COLLECTION_TAREAS_EVENTO]
    
    # Verificar que el evento existe
    evento_id_obj = database.str_to_object_id(evento_id)
    evento = eventos_collection.find_one({"_id": evento_id_obj})
    if not evento:
        raise HTTPException(status_code=404, detail="Evento no encontrado")
    
    query = {"evento_id": evento_id}
    if completada is not None:
        query["completada"] = completada
    
    tareas = list(tareas_evento_collection.find(query).sort([
        ("completada", 1),
        ("creada_en", -1)
    ]))
    
    return [models.TareaEvento.to_dict(t) for t in tareas]


@app.put("/eventos/{evento_id}/tareas/{tarea_id}", response_model=schemas.TareaEvento)
def actualizar_tarea_evento(
    evento_id: str,
    tarea_id: str,
    tarea: schemas.TareaEventoUpdate,
    current_user = Depends(auth.get_current_active_admin)
):
    """Actualizar una tarea de un evento"""
    db = database.get_database()
    eventos_collection = db[models.COLLECTION_EVENTOS]
    tareas_evento_collection = db[models.COLLECTION_TAREAS_EVENTO]
    
    # Verificar que el evento existe
    evento_id_obj = database.str_to_object_id(evento_id)
    evento = eventos_collection.find_one({"_id": evento_id_obj})
    if not evento:
        raise HTTPException(status_code=404, detail="Evento no encontrado")
    
    tarea_id_obj = database.str_to_object_id(tarea_id)
    db_tarea = tareas_evento_collection.find_one({
        "_id": tarea_id_obj,
        "evento_id": evento_id
    })
    if not db_tarea:
        raise HTTPException(status_code=404, detail="Tarea no encontrada")
    
    # Actualizar solo los campos proporcionados
    update_data = tarea.model_dump(exclude_unset=True)
    if "completada" in update_data:
        if update_data["completada"] and not db_tarea.get("completada", False):
            update_data["completada_en"] = datetime.utcnow()
        elif not update_data["completada"]:
            update_data["completada_en"] = None
    
    if update_data:
        tareas_evento_collection.update_one(
            {"_id": tarea_id_obj},
            {"$set": update_data}
        )
        db_tarea.update(update_data)
    
    return models.TareaEvento.to_dict(db_tarea)


@app.delete("/eventos/{evento_id}/tareas/{tarea_id}")
def eliminar_tarea_evento(
    evento_id: str,
    tarea_id: str,
    current_user = Depends(auth.get_current_active_admin)
):
    """Eliminar una tarea de un evento"""
    db = database.get_database()
    eventos_collection = db[models.COLLECTION_EVENTOS]
    tareas_evento_collection = db[models.COLLECTION_TAREAS_EVENTO]
    
    # Verificar que el evento existe
    evento_id_obj = database.str_to_object_id(evento_id)
    evento = eventos_collection.find_one({"_id": evento_id_obj})
    if not evento:
        raise HTTPException(status_code=404, detail="Evento no encontrado")
    
    tarea_id_obj = database.str_to_object_id(tarea_id)
    db_tarea = tareas_evento_collection.find_one({
        "_id": tarea_id_obj,
        "evento_id": evento_id
    })
    if not db_tarea:
        raise HTTPException(status_code=404, detail="Tarea no encontrada")
    
    tareas_evento_collection.delete_one({"_id": tarea_id_obj})
    return {"message": "Tarea eliminada correctamente"}


@app.patch("/eventos/{evento_id}/tareas/{tarea_id}/toggle")
def toggle_tarea_evento(
    evento_id: str,
    tarea_id: str,
    current_user = Depends(auth.get_current_active_admin)
):
    """Alternar el estado de completada de una tarea de un evento"""
    db = database.get_database()
    eventos_collection = db[models.COLLECTION_EVENTOS]
    tareas_evento_collection = db[models.COLLECTION_TAREAS_EVENTO]
    
    # Verificar que el evento existe
    evento_id_obj = database.str_to_object_id(evento_id)
    evento = eventos_collection.find_one({"_id": evento_id_obj})
    if not evento:
        raise HTTPException(status_code=404, detail="Evento no encontrado")
    
    tarea_id_obj = database.str_to_object_id(tarea_id)
    db_tarea = tareas_evento_collection.find_one({
        "_id": tarea_id_obj,
        "evento_id": evento_id
    })
    if not db_tarea:
        raise HTTPException(status_code=404, detail="Tarea no encontrada")
    
    nueva_completada = not db_tarea.get("completada", False)
    update_data = {"completada": nueva_completada}
    if nueva_completada:
        update_data["completada_en"] = datetime.utcnow()
    else:
        update_data["completada_en"] = None
    
    tareas_evento_collection.update_one({"_id": tarea_id_obj}, {"$set": update_data})
    db_tarea.update(update_data)
    return models.TareaEvento.to_dict(db_tarea)


@app.get("/{full_path:path}", include_in_schema=False)
def serve_frontend_app(full_path: str):
    if FRONTEND_DIST_PATH.exists():
        requested = FRONTEND_DIST_PATH / full_path
        if requested.is_file():
            return FileResponse(requested)
        index_response = _serve_frontend_index()
        if index_response:
            return index_response
    raise HTTPException(status_code=404, detail="Recurso no encontrado")


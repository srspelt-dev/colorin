from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
import models
import database

# Configuración de seguridad
SECRET_KEY = "tu-clave-secreta-super-segura-cambiar-en-produccion-minimo-32-caracteres"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 días

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verificar contraseña"""
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    """Hashear contraseña"""
    return pwd_context.hash(password)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    """Crear token JWT"""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def authenticate_user(username: str, password: str):
    """Autenticar usuario"""
    db = database.get_database()
    usuarios_collection = db[models.COLLECTION_USUARIOS]
    
    user_doc = usuarios_collection.find_one({"username": username})
    if not user_doc:
        return False
    
    if not verify_password(password, user_doc["hashed_password"]):
        return False
    
    if not user_doc.get("activo", True):
        return False
    
    # Convertir a dict con id como string para compatibilidad
    user = models.Usuario.to_dict(user_doc)
    # Crear un objeto tipo dict que se pueda usar como antes
    class UserDict:
        def __init__(self, data):
            for key, value in data.items():
                setattr(self, key, value)
    
    return UserDict(user)


def get_db():
    """Dependencia para obtener la base de datos de MongoDB"""
    return database.get_database()


async def get_current_user(
    token: str = Depends(oauth2_scheme)
):
    """Obtener usuario actual desde token"""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="No se pudo validar las credenciales",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    
    db = database.get_database()
    usuarios_collection = db[models.COLLECTION_USUARIOS]
    user_doc = usuarios_collection.find_one({"username": username})
    
    if user_doc is None:
        raise credentials_exception
    
    user = models.Usuario.to_dict(user_doc)
    # Crear un objeto tipo dict que se pueda usar como antes
    class UserDict:
        def __init__(self, data):
            for key, value in data.items():
                setattr(self, key, value)
    
    return UserDict(user)


async def get_current_active_user(
    current_user = Depends(get_current_user)
):
    """Verificar que el usuario está activo"""
    if not current_user.activo:
        raise HTTPException(status_code=400, detail="Usuario inactivo")
    return current_user


async def get_current_active_admin(
    current_user = Depends(get_current_user)
):
    """Verificar que el usuario es admin activo"""
    if not current_user.activo:
        raise HTTPException(status_code=400, detail="Usuario inactivo")
    if not current_user.es_admin:
        raise HTTPException(status_code=403, detail="No tienes permisos de administrador")
    return current_user

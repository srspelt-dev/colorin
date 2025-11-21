from pymongo import MongoClient
from pymongo.database import Database
from bson import ObjectId
import os
from urllib.parse import quote_plus

# Configuración de MongoDB
MONGODB_USERNAME = os.getenv("MONGODB_USERNAME", "colorin")
MONGODB_PASSWORD = os.getenv("MONGODB_PASSWORD", "facilito!23")
MONGODB_CLUSTER = os.getenv("MONGODB_CLUSTER", "colorin.uukmsjh.mongodb.net")
MONGODB_DB_NAME = os.getenv("MONGODB_DB_NAME", "colorin")


# Codificar la contraseña y usuario para URL (maneja caracteres especiales)
encoded_username = quote_plus(MONGODB_USERNAME)
encoded_password = quote_plus(MONGODB_PASSWORD)

# Construir la URL de conexión con el nombre de la base de datos
MONGODB_URL = f"mongodb+srv://{encoded_username}:{encoded_password}@{MONGODB_CLUSTER}/{MONGODB_DB_NAME}?retryWrites=true&w=majority&appName=COLORIN"

# Cliente de MongoDB
client: MongoClient = None
db: Database = None


def get_database():
    """Obtener la base de datos de MongoDB"""
    global client, db
    if client is None:
        try:
            client = MongoClient(MONGODB_URL, serverSelectionTimeoutMS=5000)
            # Verificar la conexión
            client.server_info()
            db = client[MONGODB_DB_NAME]
        except Exception as e:
            print(f"Error conectando a MongoDB: {e}")
            print(f"URL de conexión: mongodb+srv://{MONGODB_USERNAME}:***@{MONGODB_CLUSTER}/{MONGODB_DB_NAME}")
            raise
    return db


def close_database():
    """Cerrar la conexión a MongoDB"""
    global client
    if client:
        client.close()
        client = None


# Helper para convertir ObjectId a string
def object_id_to_str(obj):
    """Convertir ObjectId a string para respuestas JSON"""
    if isinstance(obj, ObjectId):
        return str(obj)
    if isinstance(obj, dict):
        return {k: object_id_to_str(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [object_id_to_str(item) for item in obj]
    return obj


# Helper para convertir string a ObjectId
def str_to_object_id(id_str):
    """Convertir string a ObjectId"""
    try:
        return ObjectId(id_str)
    except:
        return None

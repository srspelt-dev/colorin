"""
Script para crear el usuario administrador inicial
Ejecutar: python create_admin.py o docker compose exec api python create_admin.py
"""
import database
import models
import auth
from datetime import datetime

try:
    # Obtener la base de datos
    db = database.get_database()
    usuarios_collection = db[models.COLLECTION_USUARIOS]
    
    print("=" * 50)
    print("Crear Usuario Administrador")
    print("=" * 50)
    
    # Pedir datos del usuario
    username = input("Usuario (admin): ").strip() or "admin"
    email = input("Email: ").strip()
    if not email:
        print("❌ El email es requerido")
        exit(1)
    
    password = input("Contraseña: ").strip()
    if not password:
        print("❌ La contraseña es requerida")
        exit(1)
    
    # Verificar si el username ya existe
    if usuarios_collection.find_one({"username": username}):
        print(f"❌ El usuario '{username}' ya existe")
        exit(1)
    
    # Verificar si el email ya existe
    if usuarios_collection.find_one({"email": email}):
        print(f"❌ El email '{email}' ya está registrado")
        exit(1)
    
    # Crear usuario
    hashed_password = auth.get_password_hash(password)
    nuevo_usuario = models.Usuario.create(
        username=username,
        email=email,
        hashed_password=hashed_password,
        activo=True,
        es_admin=True
    )
    
    # Insertar en MongoDB
    result = usuarios_collection.insert_one(nuevo_usuario)
    
    print("\n" + "=" * 50)
    print("✅ Usuario administrador creado exitosamente!")
    print("=" * 50)
    print(f"\nUsuario: {username}")
    print(f"Email: {email}")
    print(f"ID: {result.inserted_id}")
    print(f"\nAhora puedes iniciar sesión en el frontend con estas credenciales.")
    
except Exception as e:
    print(f"❌ Error: {e}")
    import traceback
    traceback.print_exc()
finally:
    database.close_database()


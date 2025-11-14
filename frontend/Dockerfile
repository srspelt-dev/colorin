FROM node:20-alpine

WORKDIR /app

# Instalar dependencias primero para aprovechar la caché
COPY package*.json ./
RUN npm install

# Copiar el resto del frontend
COPY . .

EXPOSE 61234

# Ejecutar Vite en modo desarrollo accesible externamente
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "61234"]


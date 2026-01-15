FROM node:20-alpine

# Crear directorio de trabajo
WORKDIR /app

# Copiar archivos de dependencias
COPY package*.json ./

# Instalar dependencias
RUN npm ci --only=production

# Copiar código fuente compilado
COPY dist/ ./dist/
COPY config/ ./config/
COPY data/ ./data/

# Crear directorios necesarios
RUN mkdir -p logs

# Variables de entorno por defecto
ENV NODE_ENV=production
ENV PERSISTENCE_TYPE=json

# Exponer puerto (si es necesario para health checks)
EXPOSE 3000

# Comando para iniciar el bot
CMD ["node", "dist/index.js"]

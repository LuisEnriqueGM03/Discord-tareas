FROM node:20-alpine

# Crear directorio de trabajo
WORKDIR /app

# Copiar archivos de dependencias
COPY package*.json ./

# Instalar dependencias (incluyendo devDependencies para TypeScript)
RUN npm ci

# Copiar código fuente
COPY src/ ./src/
COPY tsconfig.json ./

# Compilar TypeScript a JavaScript
RUN npm run build

# Instalar solo dependencias de producción después de la compilación assaa
RUN npm ci --only=production

# Copiar configuración
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

# Discord Task Bot

Bot de Discord que permite a los usuarios ejecutar tareas con duración y cooldown configurables mediante embeds interactivos con botones.

## 🚀 Características

- **Mesas de Tareas**: Crear mesas con título, descripción y color personalizables
- **Tareas Configurables**: Cada tarea tiene duración y cooldown independientes
- **Botones Interactivos**: Los usuarios interactúan mediante botones en embeds
- **Notificaciones por DM**: El bot notifica cuando una tarea se completa
- **Estados de Tarea**: Running, Cooldown, Available

## 📋 Requisitos

- Node.js 20 LTS
- npm o yarn
- (Opcional) PostgreSQL para producción
- (Opcional) Docker y Docker Compose

## 🛠️ Instalación

### 1. Clonar e instalar dependencias

```bash
npm install
```

### 2. Configurar variables de entorno

Copiar el archivo `.env.example` a `.env` y configurar:

```bash
cp .env.example .env
```

Editar `.env` con tu token de Discord y otros valores.

### 3. Compilar TypeScript

```bash
npm run build
```

### 4. Configurar mesas de tareas

Editar los archivos JSON en `config/taskboards/` con los IDs reales de tus canales y servidores.

## 🏃 Ejecución

### Desarrollo

```bash
npm run dev
```

### Producción

```bash
npm run build
npm start
```

### Con PM2

```bash
npm run pm2:start
```

### Con Docker

```bash
# Solo bot (JSON)
docker-compose --profile json-only up -d

# Bot + PostgreSQL
docker-compose up -d
```

## 📁 Estructura del Proyecto

```
discord-task-bot/
├── src/
│   ├── domain/           # Modelos, puertos, excepciones
│   ├── application/      # Servicios y casos de uso
│   └── infrastructure/   # Adaptadores y configuración
├── config/taskboards/    # Configuración de mesas de tareas
├── data/                 # Persistencia JSON
└── logs/                 # Archivos de log
```

## 📄 Configuración de Mesas de Tareas

Crear archivos JSON en `config/taskboards/`:

```json
{
  "channelId": "ID_DEL_CANAL",
  "guildId": "ID_DEL_SERVIDOR",
  "title": "🎣 Actividades",
  "description": "Descripción del embed",
  "color": "#3498db",
  "tasks": [
    {
      "name": "Nombre de la tarea",
      "durationMinutes": 60,
      "cooldownMinutes": 1440,
      "description": "Descripción opcional",
      "emoji": "🎣",
      "buttonStyle": "Primary"
    }
  ]
}
```

### Estilos de Botón Disponibles

- `Primary` (azul)
- `Secondary` (gris)
- `Success` (verde)
- `Danger` (rojo)

## 🔧 Comandos del Bot

- `/createboard <config>` - Crear una mesa de tareas desde un archivo de configuración (solo administradores)

## 📊 Estados de las Tareas

| Estado | Descripción |
|--------|-------------|
| **AVAILABLE** | La tarea está disponible para iniciar |
| **RUNNING** | La tarea está en ejecución |
| **ON_COOLDOWN** | La tarea terminó pero está en cooldown |
| **COMPLETED** | La tarea se completó |

## 🔄 Migración a PostgreSQL

1. Cambiar `PERSISTENCE_TYPE=typeorm` en `.env`
2. Configurar las variables de base de datos
3. Reiniciar el bot

## 📝 Licencia

ISC

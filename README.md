# Blink - Compartición Segura de Mensajes

**Blink** es una herramienta de código abierto para compartir mensajes y archivos de forma segura mediante encriptación de extremo a extremo. Los mensajes se autodestruyen después de ser leídos o cuando expira su tiempo de vida, garantizando privacidad total.

## Características

- **Encriptación de extremo a extremo** con AES-GCM de 256 bits
- **Tiempo activo configurable** - Los mensajes expiran automáticamente
- **Protección por contraseña opcional** - Seguridad adicional con PBKDF2
- **Adjuntar archivos** hasta 10MB (también encriptados)
- **Códigos QR** para compartir enlaces fácilmente
- **Zero-knowledge** - El servidor nunca ve el contenido sin encriptar
- **Límite de usos** - Controla cuántas veces se puede acceder al mensaje
- **Dockerizado** para despliegue sencillo

## Instalación

### Instalación con Docker (Recomendado)

1. **Clona el repositorio:**
   ```bash
   git clone https://github.com/cristian-haro/blink.git
   cd blink
   ```

2. **Configura las variables de entorno (opcional):**
   
   Copia el archivo de ejemplo:
   ```bash
   cp .env.example .env
   ```
   
   Edita `.env` según tus necesidades:
   ```env
   PORT=3000
   REDIS_URL=redis://redis-service:6379
   MAX_BODY_SIZE=50mb
   RATE_LIMIT_WINDOW_MS=900000
   RATE_LIMIT_MAX_REQUESTS=1000
   ```

3. **Inicia la aplicación:**
   ```bash
   docker-compose up --build -d
   ```

4. **Accede a la aplicación:**
   
   Abre tu navegador en `http://localhost:3000`

### Instalación para Producción

Para entornos de producción, utiliza el archivo `docker-compose.prod.yml`:

```bash
docker-compose -f docker-compose.prod.yml up --build -d
```

Asegúrate de configurar las variables de entorno apropiadas para producción.

## Guía de Uso

### Enviar un Mensaje Seguro

1. **Escribe tu mensaje** en el área de texto principal
2. **Configura las opciones:**
   - **Tiempo de validez:** Cuánto tiempo estará disponible el mensaje (1h, 24h, 7 días)
   - **Límite de usos:** Cuántas veces se puede ver el mensaje (por defecto: 1)
   - **Contraseña (opcional):** Protección adicional con contraseña
3. **Adjunta un archivo (opcional):** Arrastra y suelta o haz clic en la zona de archivos
4. **Haz clic en "Generar Enlace Seguro"**
5. **Comparte el enlace generado:**
   - Copia el enlace directamente
   - Escanea el código QR
   - Envía por correo electrónico

### Recibir un Mensaje Seguro

1. **Abre el enlace** que te compartieron
2. **Si está protegido por contraseña:**
   - Introduce la contraseña proporcionada
   - Tienes 3 intentos antes de que el mensaje se autodestruya
3. **Haz clic en "Ver Contenido Secreto"**
4. **Lee el mensaje y descarga archivos adjuntos** si los hay
5. **Copia el contenido** si necesitas guardarlo (el mensaje se destruirá)

> **IMPORTANTE:** No recargues la página después de ver el mensaje, ya que podría autodestruirse y perderás el acceso.

## 🔧 Configuración

### Variables de Entorno

| Variable | Descripción | Valor por Defecto |
|----------|-------------|-------------------|
| `PORT` | Puerto del servidor | `3000` |
| `REDIS_URL` | URL de conexión a Redis | `redis://localhost:6379` |
| `MAX_BODY_SIZE` | Tamaño máximo del cuerpo de la petición | `50mb` |
| `RATE_LIMIT_WINDOW_MS` | Ventana de tiempo para rate limiting (ms) | `900000` (15 min) |
| `RATE_LIMIT_MAX_REQUESTS` | Máximo de peticiones por ventana | `1000` |

### Límites y Restricciones

- **Tamaño máximo de archivo:** 10 MB
- **Tiempo de vida máximo:** 7 días
- **Intentos de contraseña:** 3 intentos antes de autodestrucción
- **Vistas máximas:** Configurable (1-100)


### Seguridad

#### Encriptación
- **Algoritmo:** AES-GCM de 256 bits
- **Derivación de clave (con contraseña):** PBKDF2 con 100,000 iteraciones y SHA-256
- **Vector de inicialización (IV):** 12 bytes aleatorios por mensaje
- **Salt:** 16 bytes aleatorios para derivación de clave

#### Flujo de Seguridad

1. **Envío:**
   - El mensaje se encripta en el navegador del emisor
   - Solo los datos encriptados se envían al servidor
   - La clave de encriptación se incluye en el fragmento de URL (#) que nunca llega al servidor

2. **Almacenamiento:**
   - Redis almacena solo datos encriptados
   - TTL automático para expiración
   - Contador de vistas para autodestrucción

3. **Recepción:**
   - La clave se extrae del fragmento de URL en el navegador
   - La desencriptación ocurre completamente en el cliente
   - El servidor nunca tiene acceso a la clave o contenido sin encriptar

## 📁 Estructura del Proyecto

```
encriptador/
├── public/              # Archivos estáticos
│   ├── index.html       # Página principal (envío)
│   ├── view.html        # Página de visualización (recepción)
│   ├── style.css        # Estilos globales
│   ├── app.js           # Lógica del emisor
│   └── view.js          # Lógica del receptor
├── server.js            # Servidor Express
├── package.json         # Dependencias Node.js
├── Dockerfile           # Imagen Docker
├── docker-compose.yml   # Configuración desarrollo
├── docker-compose.prod.yml  # Configuración producción
├── .env.example         # Ejemplo de variables de entorno
├── .dockerignore        # Archivos ignorados por Docker
└── README.md            # Guía de uso
```

## Privacidad y Seguridad

- **Zero-knowledge:** El servidor nunca tiene acceso a tus mensajes sin encriptar
- **Sin registro:** No se almacenan logs de contenido
- **Autodestrucción:** Los mensajes se eliminan automáticamente
- **Código abierto:** Puedes auditar el código completo

---

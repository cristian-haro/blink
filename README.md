# Blink - Compartición Segura de Mensajes

**Blink** es una herramienta de código abierto para compartir mensajes y archivos de forma segura mediante encriptación de extremo a extremo. Los mensajes se autodestruyen después de ser leídos o cuando expira su tiempo de vida, garantizando privacidad total.

## Características

- **Encriptación de extremo a extremo** con AES-GCM de 256 bits
- **Autodestrucción configurable** - Los mensajes expiran automáticamente
- **Protección por contraseña opcional** - Seguridad adicional con PBKDF2
- **Adjuntar archivos** hasta 10MB (también encriptados)
- **Códigos QR** para compartir enlaces fácilmente
- **Zero-knowledge** - El servidor nunca ve el contenido sin encriptar
- ⏱**Límite de vistas** - Controla cuántas veces se puede acceder al mensaje
- **Dockerizado** para despliegue sencillo

## Instalación

### Requisitos Previos

- [Docker](https://www.docker.com/get-started) y Docker Compose instalados
- Puerto 3000 disponible (configurable)

### Instalación con Docker (Recomendado)

1. **Clona el repositorio:**
   ```bash
   git clone <tu-repositorio>
   cd encriptador
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

## 📖 Guía de Uso

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

## 🏗️ Arquitectura Técnica

### Stack Tecnológico

**Frontend:**
- HTML5, CSS3, JavaScript (Vanilla)
- Web Crypto API para encriptación cliente
- QRCode.js para generación de códigos QR

**Backend:**
- Node.js con Express
- Redis para almacenamiento temporal
- Helmet para seguridad HTTP
- Express Rate Limit para protección contra abuso

**Infraestructura:**
- Docker y Docker Compose
- Nginx (opcional, para producción)

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

## 🛠️ Comandos Útiles

### Desarrollo

```bash
# Iniciar en modo desarrollo
docker-compose up --build

# Ver logs en tiempo real
docker-compose logs -f

# Detener servicios
docker-compose down

# Limpiar todo (incluyendo volúmenes)
docker-compose down -v
```

### Producción

```bash
# Iniciar en producción
docker-compose -f docker-compose.prod.yml up --build -d

# Ver estado de contenedores
docker-compose -f docker-compose.prod.yml ps

# Reiniciar servicios
docker-compose -f docker-compose.prod.yml restart
```

### Mantenimiento

```bash
# Limpiar caché de Docker
docker builder prune -a -f

# Ver logs del servidor
docker logs blink-app

# Ver logs de Redis
docker logs redis-service

# Acceder al contenedor
docker exec -it blink-app sh
```

## 🐛 Solución de Problemas

### El botón "Generar Enlace" no funciona

**Problema:** Errores de CSP en la consola del navegador.

**Solución:** 
- Desactiva temporalmente bloqueadores de anuncios (AdGuard, uBlock) para `localhost`
- O añade `localhost` a la lista blanca de tu bloqueador

### Puerto 3000 ya está en uso

**Solución:**
```bash
# Detener todos los contenedores
docker-compose down --remove-orphans

# O cambiar el puerto en .env
PORT=3001
```

### Redis no se conecta

**Solución:**
```bash
# Verificar que Redis esté corriendo
docker ps | grep redis

# Reiniciar Redis
docker-compose restart redis-service
```

### El modal de contraseña no aparece

**Solución:**
- Asegúrate de que la aplicación esté actualizada: `docker-compose up --build -d`
- Limpia la caché del navegador (Ctrl+Shift+R)

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
└── README.md            # Este archivo
```

## 🤝 Contribuir

Las contribuciones son bienvenidas. Por favor:

1. Haz fork del proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## 📄 Licencia

Este proyecto está bajo la licencia MIT. Ver el archivo `LICENSE` para más detalles.

## 🔐 Privacidad y Seguridad

- **Zero-knowledge:** El servidor nunca tiene acceso a tus mensajes sin encriptar
- **Sin registro:** No se almacenan logs de contenido
- **Autodestrucción:** Los mensajes se eliminan automáticamente
- **Código abierto:** Puedes auditar el código completo

## 📞 Soporte

Si encuentras algún problema o tienes preguntas:

1. Revisa la sección de [Solución de Problemas](#-solución-de-problemas)
2. Abre un issue en GitHub
3. Consulta la documentación técnica en el código

---

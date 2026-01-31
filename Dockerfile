# Usamos una imagen ligera de Node.js
FROM node:20-slim

# Crear directorio de trabajo
WORKDIR /app

# Copiar archivos de dependencias
COPY package*.json ./

# Instalar dependencias
RUN npm install --production

# Copiar el resto del código (incluida la carpeta /public)
COPY . .

# Exponer el puerto que usa tu server.js
EXPOSE 3000

# Comando para arrancar
CMD ["node", "server.js"]
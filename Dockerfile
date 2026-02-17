# ============================================
# LasaEdu - App Container (Vite Dev Server)
# ============================================
FROM node:20-alpine

WORKDIR /app

# Copiar archivos de dependencias
COPY package*.json ./

# Instalar dependencias
RUN npm ci

# Copiar el resto del proyecto
COPY . .

# Puerto del dev server de Vite
EXPOSE 5173

# Iniciar Vite dev server escuchando en todas las interfaces
CMD ["npx", "vite", "--host", "0.0.0.0"]

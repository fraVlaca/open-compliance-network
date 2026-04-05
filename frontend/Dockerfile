FROM node:20-slim

WORKDIR /app

# Install deps
COPY package.json package-lock.json* ./
RUN npm install

# Copy source
COPY . .

ENV VITE_BACKEND_URL=http://localhost:3001

EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]

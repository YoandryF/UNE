# ⚡ Consumo Eléctrico UNE - Cuba

Aplicación web progresiva (PWA) para el control y registro del consumo eléctrico residencial en Cuba, basada en el tarifario oficial de la Unión Nacional Eléctrica (UNE).

## 📸 Características

### 🧮 Calculadora de Factura
- Cálculo instantáneo de factura por consumo en kWh
- Calculadora inversa: ¿cuánto puedo consumir con mi presupuesto?
- Desglose detallado por rangos de tarifa
- Recargo del 25% automático para consumos superiores a 500 kWh

### 📊 Registro Diario de Lecturas
- Registro de lecturas del metro contador con fecha y hora
- Foto de evidencia del metro (comprimida automáticamente)
- Validación inteligente (alerta si la lectura es menor a la anterior)
- Edición de registros con fecha de última actualización
- Estimación de factura a fin de mes basada en consumo promedio diario
- Alertas al acercarse a los 500 kWh

### 📈 Gráficos y Análisis
- Gráfico de barras del consumo diario por mes
- Comparación con el mes anterior (porcentaje de variación)
- Costo promedio por día

### 🔌 Gestión de Equipos
- Registro de electrodomésticos con potencia (W) y horas de uso
- Estimación automática del consumo mensual por equipo
- Proyección de factura basada en equipos registrados

### 🔦 Registro de Apagones
- Botón para registrar inicio/fin de apagones
- Estadísticas: horas sin luz, promedio diario, racha más larga

### ⚙️ Configuración
- Tarifas editables (adaptable a cambios futuros del tarifario)
- Múltiples metros contadores (varias propiedades)
- Día de corte del ciclo de facturación configurable
- Umbral de alerta personalizable
- Tema claro/oscuro

### 💾 Persistencia de Datos
- **Backend SQLite** — Los datos se guardan en un archivo de base de datos (`data/une.db`)
- **IndexedDB** como cache local para funcionamiento offline
- **Sincronización automática** — Los cambios se envían al servidor en tiempo real
- **Resincronización** cada 60 segundos y al reconectar
- Export/Import de datos en JSON (backup adicional)
- Migración automática desde localStorage (versiones anteriores)

## 🚀 Instalación

### Requisitos
- [Node.js](https://nodejs.org/) 18+ instalado

### Pasos

```bash
# 1. Clonar el repositorio
git clone https://github.com/YoandryF/UNE.git
cd UNE

# 2. Instalar dependencias
npm install

# 3. Iniciar el servidor
npm start
```

Abrir en el navegador: `http://localhost:3000`

### Puerto personalizado

```bash
# Argumento directo
node server.js 8080

# Variable de entorno
set PORT=8080    # Windows
export PORT=8080 # Linux/Mac
npm start
```

### PWA (móvil)
1. Abrir la URL en el navegador del celular
2. Menú → "Agregar a pantalla de inicio"
3. Funciona offline después de la primera carga

## 📁 Estructura

```
UNE/
├── server.js           # Backend Node.js (API REST + SQLite + static files)
├── package.json        # Dependencias (npm install / npm update)
├── .gitignore
├── data/
│   └── une.db          # Base de datos SQLite (se crea automáticamente)
└── public/
    ├── index.html      # HTML estructura
    ├── styles.css      # Estilos
    ├── db.js           # Capa de datos (IndexedDB + sync con servidor)
    ├── app.js          # Lógica de la aplicación
    ├── sw.js           # Service Worker (cache offline)
    ├── manifest.json   # Configuración PWA
    ├── icon-192.png    # Ícono PWA 192x192
    └── icon-512.png    # Ícono PWA 512x512
```

## 🔧 API REST

El servidor expone los siguientes endpoints:

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/sync` | Obtener todos los datos |
| POST | `/api/sync` | Sincronizar todos los datos (bulk) |
| GET | `/api/readings` | Listar lecturas |
| POST | `/api/readings` | Crear/actualizar lectura(s) |
| DELETE | `/api/readings/:id` | Eliminar lectura |
| GET | `/api/equipment` | Listar equipos |
| POST | `/api/equipment` | Crear/actualizar equipo(s) |
| DELETE | `/api/equipment/:id` | Eliminar equipo |
| GET | `/api/blackouts` | Listar apagones |
| POST | `/api/blackouts` | Crear/actualizar apagón(es) |
| DELETE | `/api/blackouts/:id` | Eliminar apagón |
| GET | `/api/config` | Obtener configuración |
| POST | `/api/config` | Guardar configuración |

## 📊 Tarifario UNE (por defecto)

| Rango | Consumo (kWh) | Tarifa (CUP/kWh) |
|-------|---------------|-------------------|
| 1 | 0 – 100 | 0.33 |
| 2 | 101 – 150 | 1.07 |
| 3 | 151 – 200 | 1.43 |
| 4 | 201 – 250 | 2.46 |
| 5 | 251 – 300 | 3.00 |
| 6 | 301 – 350 | 4.00 |
| 7 | 351 – 400 | 5.00 |
| 8 | 401 – 450 | 6.00 |
| 9 | 451 – 500 | 7.00 |
| 10 | 501 – 600 | 9.20 |
| 11 | 601 – 700 | 9.45 |
| 12 | 701 – 1000 | 9.85 |
| 13 | 1001 – 1800 | 10.80 |
| 14 | 1801 – 2600 | 11.80 |
| 15 | 2601 – 3400 | 12.90 |
| 16 | 3401 – 4200 | 13.95 |
| 17 | 4201 – 5000 | 15.00 |
| 18 | Más de 5000 | 20.00 |

**Recargo:** 25% sobre los kWh que excedan los 500.

## 🧮 Fórmulas de Cálculo

**Consumo ≤ 500 kWh:**
```
Factura = Σ (kWh_rango × Tarifa_rango)
```

**Consumo > 500 kWh:**
```
Factura = Σ (primeros 500 kWh por rangos) + (Excedente × Tarifa_rango_total × 1.25)
```

## 💡 Cómo leer el metro contador

1. Leer siempre de **izquierda a derecha**
2. Si el último dígito es de **color rojo** o está después de una coma, **se ignora** (representa décimas de kWh)
3. Ejemplo: `0 3 4 2 [1]` → se lee **0342 kWh**

## 🛠️ Tecnologías

- **Frontend:** HTML5 / CSS3 / JavaScript (vanilla, sin frameworks)
- **Backend:** Node.js (http nativo, sin Express)
- **Base de datos:** SQLite via [better-sqlite3](https://github.com/WiseLibs/better-sqlite3)
- **Offline:** Service Worker + IndexedDB
- **Gráficos:** Canvas API
- **Fotos:** File API + compresión automática

## 📦 Actualización

```bash
npm update
```

## 🔒 Backup de datos

El archivo `data/une.db` contiene todos tus datos. Para hacer backup:

```bash
# Copiar a ubicación segura
copy data\une.db "D:\backups\une-backup.db"
```

También puedes usar el botón 📥 en la app para exportar a JSON.

## 📱 Compatibilidad

- Chrome/Edge 80+
- Firefox 75+
- Safari 14+
- Navegadores móviles modernos

## 📄 Licencia

Uso libre. Proyecto personal para control de consumo eléctrico doméstico.

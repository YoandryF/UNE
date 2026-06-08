# ⚡ Consumo Eléctrico UNE - Cuba

Aplicación web progresiva (PWA) para el control y registro del consumo eléctrico residencial en Cuba, basada en el tarifario oficial de la Unión Nacional Eléctrica (UNE).

## 📸 Características

### 🧮 Calculadora de Factura
- Cálculo instantáneo de factura por consumo en kWh
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

### ⚙️ Configuración
- Tarifas editables (adaptable a cambios futuros del tarifario)
- Múltiples metros contadores (varias propiedades)
- Día de corte del ciclo de facturación configurable
- Umbral de alerta personalizable
- Tema claro/oscuro

### 💾 Datos
- Almacenamiento en IndexedDB (sin límite de 5MB de localStorage)
- Cada registro histórico conserva las tarifas vigentes al momento del registro
- Export/Import de datos en JSON (backup completo)
- Migración automática desde localStorage (versiones anteriores)

## 🚀 Instalación

### Opción 1: Servidor local (WAMP/XAMPP)
Copiar la carpeta `UNE` en el directorio web:
```
C:\wamp64\www\UNE\
```
Acceder desde: `http://localhost/UNE/`

### Opción 2: Cualquier servidor HTTP
Servir los archivos estáticos. No requiere backend ni base de datos.

### Opción 3: PWA (móvil)
1. Abrir la URL en el navegador del celular
2. Menú → "Agregar a pantalla de inicio"
3. Funciona offline después de la primera carga

## 📁 Estructura

```
UNE/
├── index.html      # Aplicación completa (HTML + CSS + JS)
├── manifest.json   # Configuración PWA
├── sw.js           # Service Worker (cache offline)
├── icon-192.png    # Ícono PWA 192x192
├── icon-512.png    # Ícono PWA 512x512
└── README.md
```

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

**Recargo:** 25% sobre los kWh que excedan los 500 (la tarifa aplicada al excedente es la del rango correspondiente al consumo total).

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

- HTML5 / CSS3 / JavaScript (vanilla, sin dependencias)
- IndexedDB para almacenamiento
- Service Worker para funcionamiento offline
- Canvas API para gráficos
- File API para fotos con compresión automática

## 📱 Compatibilidad

- Chrome/Edge 80+
- Firefox 75+
- Safari 14+
- Navegadores móviles modernos

## 📄 Licencia

Uso libre. Proyecto personal para control de consumo eléctrico doméstico.

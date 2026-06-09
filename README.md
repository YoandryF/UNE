# ⚡ Consumo Eléctrico UNE - Cuba (Web PWA)

Aplicación web progresiva (PWA) para el control y registro del consumo eléctrico residencial en Cuba, basada en el tarifario oficial de la Unión Nacional Eléctrica (UNE).

## 🚀 Demo

Accede desde cualquier navegador o instálala como app en tu celular.

## 📸 Características

### 🧮 Calculadora de Factura
- Cálculo instantáneo por consumo en kWh
- Desglose detallado por rangos de tarifa
- Recargo del 25% automático para consumos >500 kWh

### 📊 Registro Diario de Lecturas
- Registro con fecha, hora y foto de evidencia
- Validación inteligente (alerta si lectura menor a la anterior)
- Edición de registros con fecha de última actualización
- Estimación de factura a fin de mes
- Alertas configurables por umbral de consumo

### 📈 Gráficos y Análisis
- Gráfico de barras del consumo diario
- Comparación con mes anterior (% variación)
- Costo promedio por día

### 🔌 Gestión de Equipos
- Registro de electrodomésticos con potencia y horas de uso
- Estimación mensual por equipo
- Equipos vinculados por metro contador

### ⚙️ Configuración
- Tarifas editables (adaptable a cambios futuros)
- Múltiples metros contadores
- Día de corte configurable
- Umbral de alerta personalizable
- Tema claro/oscuro
- Export/Import JSON

## 💾 Almacenamiento
- IndexedDB (sin límite de 5MB)
- Cada registro conserva las tarifas vigentes al momento
- Fotos comprimidas automáticamente

## 📊 Tarifario UNE (por defecto)

| Rango | Consumo (kWh) | Tarifa (CUP/kWh) |
|-------|---------------|-------------------|
| 1 | 0–100 | 0.33 |
| 2 | 101–150 | 1.07 |
| 3 | 151–200 | 1.43 |
| 4 | 201–250 | 2.46 |
| 5 | 251–300 | 3.00 |
| 6 | 301–350 | 4.00 |
| 7 | 351–400 | 5.00 |
| 8 | 401–450 | 6.00 |
| 9 | 451–500 | 7.00 |
| 10 | 501–600 | 9.20 |
| 11 | 601–700 | 9.45 |
| 12 | 701–1000 | 9.85 |
| 13 | 1001–1800 | 10.80 |
| 14 | 1801–2600 | 11.80 |
| 15 | 2601–3400 | 12.90 |
| 16 | 3401–4200 | 13.95 |
| 17 | 4201–5000 | 15.00 |
| 18 | >5000 | 20.00 |

**Recargo:** 25% sobre kWh que excedan 500.

## 🧮 Fórmulas

**≤500 kWh:** `Factura = Σ(kWh_rango × Tarifa_rango)`

**>500 kWh:** `Factura = Σ(primeros 500 por rangos) + Excedente × Tarifa_rango_total × 1.25`

## 🛠️ Instalación

### Servidor local
```bash
# Copiar al directorio web
cp -r UNE/ /var/www/html/
# Acceder en http://localhost/UNE/
```

### PWA (Celular)
1. Abrir URL en el navegador
2. Menú → "Agregar a pantalla de inicio"
3. Funciona offline después de primera carga

## 📁 Estructura
```
├── index.html      # App completa (HTML + CSS + JS)
├── manifest.json   # Configuración PWA
├── sw.js           # Service Worker (offline)
├── icon-192.png    # Ícono PWA
├── icon-512.png    # Ícono PWA
└── README.md
```

## 🤝 Contribuir

Ver [CONTRIBUTING.md](CONTRIBUTING.md)

## 📱 App Móvil

Disponible la versión Flutter en [UNE-mobile](https://github.com/YoandryF/UNE-mobile)

## 📄 Licencia

MIT License - Uso libre.

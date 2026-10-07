# App Partes de Producción — Frunet

App interna para registrar y analizar los partes de producción de confección
(aguacate, mango, piña). El usuario trabaja en español: responde en español.

## Arquitectura

- `index.html`: la app entera, empaquetada en un solo archivo (React 18 +
  fuentes embebidas en base64). **No se edita a mano.**
- `extracted/template.html`: el código fuente legible (~1.660 líneas). Aquí
  están el marcado de las pantallas (líneas ~186–853) y la lógica
  (`<script type="text/x-dc">`, desde ~854): constantes, `class Component
  extends DCLogic` y `renderVals()`.
- `extracted/assets/`: React, ReactDOM, el runtime del bundler y las fuentes.
- Datos: Supabase (`SUPABASE_URL` y clave publicable en `template.html`).
  Tablas `partes` e `inventario_items`, con RLS y suscripción realtime.
  Copia de respaldo en `localStorage` (`frunet_partes_backup`).

## Flujo de trabajo

```bash
node scripts/unbundle.js   # index.html -> extracted/ (solo si index.html cambió fuera)
# editar extracted/template.html
node scripts/bundle.js     # extracted/ -> index.html
node scripts/serve.js      # http://localhost:5500
```

Tras editar `template.html` hay que ejecutar siempre `bundle.js` y subir los
dos archivos juntos. Sin dependencias npm: solo Node.

Otros scripts: `extract_data.js` (saca SEED / EXCEL_JULIO / INVENTORY_SEED a
JSON) y `gen_sql.js` (genera los `insert_*.sql` de la migración inicial).

## Reglas de negocio

- Número de parte: `aa` + semana ISO `ww` + secuencial de 2 dígitos
  (p. ej. `262701`). Lo calcula `generarNumeroParte()` en el cliente.
- Validación al guardar: kg volcados = kg confeccionados + tirados + cat. II
  + verdes + duros. Los kg confeccionados son netos.
- Si el trabajo es `RECONFECCIÓN`, el tipo de reconfección es obligatorio.
- Horas ajustadas = horas reales − descanso. Productividad = cajas (o kg) /
  horas ajustadas. Coste = €/hora-persona × personas × horas ajustadas.
- Pantallas: Inicio, Partes, Nuevo parte (todos); Historial, Panel de
  producción, Reportes, Inventario (solo administrador).

## Pendientes conocidos

1. Login de administrador desactivado: `submitLogin()` da acceso a cualquiera
   (marcado como provisional).
2. El número de parte puede duplicarse (se calcula en el navegador contando
   los partes de la semana; falla con guardados simultáneos o tras un borrado).
3. "Importar datos" solo cambia el estado local, no escribe en Supabase.
4. El coste por hora y persona (12,5 €) no se guarda; se pierde al recargar.
5. Al editar un parte no se puede cambiar la fecha.

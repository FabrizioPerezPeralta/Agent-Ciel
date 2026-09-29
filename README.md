# Ciel Taller

Ciel Taller es el espacio de diseño 3D de Agent-Ciel. Convierte descripciones en piezas y figuras compuestas, permite editar sus sólidos y operaciones booleanas en una vista interactiva y exporta mallas STL para preparar la impresión en un laminador.

## Desarrollo

Requiere Node.js 20 o superior.

```bash
npm install
npm run dev
```

Para ejecutar la aplicación nativa con Tauri 2, instala Rust y el CLI de Tauri:

```bash
cargo install tauri-cli
cargo tauri dev
```

La aplicación de escritorio abre el modelador usando Ollama en `http://localhost:11434` y el modelo `qwen2.5:7b` por defecto. Instala Ollama y descarga el modelo con `ollama pull qwen2.5:7b`, o cambia proveedor, URL y modelo desde el indicador del motor en la barra superior. Para una API compatible con OpenAI, configura la URL base y el modelo; la clave se almacena o elimina desde el almacén seguro del sistema operativo. `npm run dev` funciona en modo navegador y utiliza únicamente el intérprete básico local.

## Arquitectura

- `src/features/modeler/model.types.ts`: especificación paramétrica de la pieza y contrato de proveedores de generación.
- `src/features/modeler/model-generator.ts`: intérprete básico para modo navegador.
- `src/features/modeler/model-geometry.ts`: geometrías, operaciones CSG de unión, sustracción e intersección y exportación STL.
- `src/features/modeler/provider-settings.ts`: contrato frontend con los comandos nativos de generación y configuración.
- `src/features/modeler/ModelSettingsDialog.tsx`: configuración de proveedor, URL y modelo.
- `src/features/modeler/ModelStudio.tsx`: espacio de trabajo, vista 3D, ensamblaje de componentes y controles de exportación.
- `src-tauri/src/lib.rs`: adaptadores nativos para Ollama y APIs compatibles con OpenAI; valida la salida estructurada antes de entregarla al modelador.

En la aplicación de escritorio se puede configurar Ollama local o una API compatible con OpenAI. La clave API se guarda en el almacén seguro del sistema operativo y no se escribe en el archivo de configuración. En modo navegador se usa un intérprete local sencillo, sin llamadas de red.

## Composición de modelos

Cada modelo combina hasta 32 sólidos paramétricos: caja, cilindro, esfera, elipsoide, cono, toroide o cápsula. Las formas se pueden posicionar y rotar; las operaciones booleanas permiten unir cuerpos, restar agujeros o intersectar volúmenes. Esto permite generar soportes, carcasas sencillas, figuras articuladas estilizadas y otros diseños componibles desde una descripción.

La IA devuelve una receta geométrica controlada, no una malla arbitraria: no es un sustituto de CAD avanzado ni garantiza que una pieza compleja sea imprimible. Proyectos persistentes, importación de mallas, escultura/texturas, validación de paredes y soportes, exportación 3MF, ensamblajes imprimibles de varias piezas y envío directo a impresoras todavía no están implementados. La exportación STL usa milímetros y sitúa la base sobre el plano de impresión; revisa la malla y los parámetros en tu laminador antes de fabricar.

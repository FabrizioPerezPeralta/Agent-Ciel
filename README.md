# Ciel

Ciel es un agente de IA local, privado y personalizable para Windows, macOS y Linux. Este repositorio contiene el prototipo de la interfaz de escritorio: un espacio para conversar con el agente, crear automatizaciones, preparar proyectos, gestionar agentes y conectar skills o servidores MCP.

## Desarrollo

Requiere Node.js 20 o superior.

```bash
npm install
npm run dev
```

Para preparar el empaquetado nativo, instala Rust y el CLI de Tauri 2:

```bash
cargo install tauri-cli
cargo tauri dev
```

## Dirección del proyecto

- **Local-first:** los modelos, credenciales y acciones deben ejecutarse en el equipo del usuario, con confirmación explícita para operaciones sensibles.
- **Extensible:** automatizaciones, agentes, skills y MCP se registran como capacidades independientes.
- **Multiplataforma:** la interfaz web se puede empaquetar como aplicación nativa con Tauri sin duplicar la experiencia.
- **Siempre visible:** el orb de Ciel es la primera pieza de una ventana compacta, flotante y opcionalmente siempre encima de otras aplicaciones.

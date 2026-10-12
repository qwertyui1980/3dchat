# Directivas de Trabajo y Reglas de Desarrollo (XStreamX)

## 1. Consulta Obligatoria de Contexto Técnico
Al inicio de cada nueva sesión o prompt, el asistente **DEBE consultar [TECH_REFERENCE.md](file:///d:/Apps/xstreamx/TECH_REFERENCE.md)** para alinearse con la arquitectura, componentes y estado actual del proyecto:
* **Privacidad por Diseño (Cero Transmisión de Video):** El rastreo facial con MediaPipe se ejecuta 100% en el cliente (navegador/edge). Nunca se transmite video de la cámara para los avatares; únicamente se envía el flujo ligero de blendshapes ARKit (~300 bytes/frame). El renderizado 3D de avatares es local en Three.js.
* **Red Híbrida Cuádruple:** PeerJS WebRTC P2P direct data mesh, MQTT WebSockets broker fallback, Supabase Realtime y Socket.io en `server.ts`.
* **Licencia y Atribución:** Licencia Apache 2.0 con mención obligatoria de origen: *"Origin: Originally created and developed by XStreamX"*.
* **Repositorio Privado:** `https://github.com/qwertyui1980/3dchat.git`.

## 2. Actualización Continua de TECH_REFERENCE.md
Siempre que se realicen cambios relevantes en la arquitectura, componentes, servicios, modelos 3D, lógica de red o parámetros del estudio:
* El asistente **debe actualizar [TECH_REFERENCE.md](file:///d:/Apps/xstreamx/TECH_REFERENCE.md)** para reflejar fielmente las modificaciones y mantener la documentación técnica como fuente única de verdad viva del proyecto.

# XSTREAMX - 3D Avatar Video Communication

> **Private Repository Source:** [https://github.com/qwertyui1980/3dchat.git](https://github.com/qwertyui1980/3dchat.git)  
> **Origin:** Originally created and developed by **XStreamX**.

Private, lightweight real-time 3D avatar telepresence powered by MediaPipe anatomical face tracking, Three.js WebGL graphics, and ultra-low-bandwidth WebRTC data channel mesh communication (zero video frame transmission).

---

## ⚠️ Legal Disclaimer & Total Exception of Liability

### 1. Total Exception of Functioning & "AS IS" Disclaimer
This software and associated documentation is provided **"AS IS"** and **"AS AVAILABLE"**, without warranty of any kind, express or implied, including but not limited to the warranties of merchantability, fitness for a particular purpose, security, uptime, or error-free operation.

### 2. Complete Personal Responsibility
**Any download, deployment, hosting, modification, testing, execution, or use of this software is done entirely at your own discretion and under your sole, complete personal responsibility and risk.**

The creators, authors, and contributors accept **ABSOLUTELY NO LIABILITY OR RESPONSIBILITY** for:
- Any direct, indirect, incidental, consequential, special, or exemplary damages.
- Any service interruptions, tracking inaccuracies, data loss, audio/video device issues, hardware failures, or network downtime.
- Any privacy disclosures, misuse, legal infringements, or regulatory non-compliance arising from the use or deployment of this software.

### 3. Permissive License & Origin Attribution
You are free to download, copy, modify, distribute, host, deploy, and use this software however you see fit under the condition that you retain the original origin attribution:
```
Origin: Originally created and developed by XStreamX.
```
For the full legal text, please read the [LICENSE](LICENSE) file.

---

## 🚀 Quick Start

### Prerequisites
- Node.js (v18+)
- npm or bun

### 1. Install Dependencies
```bash
npm install
```

### 2. Run in Development Mode
```bash
npm run dev
```

### 3. Build for Production
```bash
npm run build
```

---

## 🔒 Privacy-by-Design Architecture & Data Transmission

XStreamX is built strictly around user privacy:
- **Client-Side Edge AI Tracking:** All facial landmark detection, motion tracking, and blendshape calculations run strictly client-side on the user's local device. No raw video feed, camera footage, or biometric frames are transmitted to or stored on servers or peers for avatar communication.
- **Lightweight Blendshape Micro-Stream:** Only a tiny stream of normalized numerical blendshape coefficients and orientation angles (a few hundred bytes per frame) is transmitted over WebRTC / WebSocket channels instead of heavy video.
- **Local Client-Side 3D Rendering:** Each recipient renders the 3D avatar locally using WebGL and Three.js, maintaining maximum scalability, ultra-low server and bandwidth costs, and complete biometric privacy.

---

## 📄 License

Released under the **Apache License, Version 2.0** with Origin Attribution and Privacy-by-Design Architecture terms. See [LICENSE](LICENSE) for full details.

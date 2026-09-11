import { useState } from "react";
import { Canvas } from "@react-three/fiber";
import { Float, MeshDistortMaterial, OrbitControls, Stars } from "@react-three/drei";
import {
  Activity, Bot, Boxes, ChevronDown, CircleHelp, FolderKanban, LayoutGrid,
  MessageSquare, Plus, Puzzle, Search, Settings2, Sparkles, TerminalSquare,
  Zap, type LucideIcon
} from "lucide-react";

type NavItem = { label: string; icon: LucideIcon; badge?: string };

const navItems: NavItem[] = [
  { label: "Inicio", icon: LayoutGrid },
  { label: "Conversación", icon: MessageSquare },
  { label: "Automatizaciones", icon: Zap, badge: "3" },
  { label: "Proyectos", icon: FolderKanban },
  { label: "Agentes", icon: Bot },
  { label: "Skills & MCP", icon: Puzzle }
];

function CielOrb() {
  return (
    <div className="orb-stage" aria-label="Ciel está listo">
      <div className="orb-glow" />
      <Canvas camera={{ position: [0, 0, 4.5], fov: 42 }} dpr={[1, 2]}>
        <ambientLight intensity={1.4} color="#b8c9ff" />
        <pointLight position={[3, 3, 3]} intensity={7} color="#9f7aea" />
        <pointLight position={[-3, -1, 2]} intensity={5} color="#45d5cb" />
        <Stars radius={5} depth={3} count={180} factor={2} saturation={0} fade speed={0.4} />
        <Float speed={2} rotationIntensity={0.25} floatIntensity={0.45}>
          <mesh scale={1.38}>
            <icosahedronGeometry args={[1, 32]} />
            <MeshDistortMaterial color="#7371e8" emissive="#3f3a9b" emissiveIntensity={1.2} roughness={0.25} metalness={0.2} distort={0.32} speed={1.5} />
          </mesh>
          <mesh scale={1.06}>
            <icosahedronGeometry args={[1, 24]} />
            <MeshDistortMaterial color="#78e0d2" emissive="#388f9d" emissiveIntensity={0.8} transparent opacity={0.42} roughness={0.1} metalness={0.4} distort={0.28} speed={2} />
          </mesh>
        </Float>
        <OrbitControls enableZoom={false} enablePan={false} autoRotate autoRotateSpeed={0.8} />
      </Canvas>
    </div>
  );
}

function App() {
  const [active, setActive] = useState("Inicio");
  const [prompt, setPrompt] = useState("");
  const [messages, setMessages] = useState(["¡Hola! Soy Ciel. ¿Qué creamos hoy?"]);

  const sendMessage = () => {
    const value = prompt.trim();
    if (!value) return;
    setMessages((current) => [...current, value, "Entendido. Prepararé un plan local y te pediré confirmación antes de ejecutar cambios."]);
    setPrompt("");
  };

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand"><div className="brand-mark"><Sparkles size={17} /></div><span>Ciel</span><span className="local-pill">LOCAL</span></div>
        <button className="new-task"><Plus size={17} /> Nueva tarea <span>⌘ K</span></button>
        <nav>
          <div className="nav-caption">ESPACIO DE TRABAJO</div>
          {navItems.map(({ label, icon: Icon, badge }) => (
            <button className={`nav-item ${active === label ? "active" : ""}`} onClick={() => setActive(label)} key={label}>
              <Icon size={17} /><span>{label}</span>{badge && <b>{badge}</b>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <button className="nav-item"><TerminalSquare size={17} /><span>Terminal local</span><span className="status-dot" /></button>
          <button className="nav-item"><Settings2 size={17} /><span>Configuración</span></button>
          <div className="profile"><div className="avatar">FP</div><div><strong>Fabrizio</strong><small>Personal</small></div><ChevronDown size={15} /></div>
        </div>
      </aside>

      <section className="content">
        <header className="topbar">
          <div className="breadcrumbs"><span>Workspace</span><span>/</span><strong>{active}</strong></div>
          <div className="top-actions"><button className="icon-button"><Search size={18} /></button><button className="icon-button"><CircleHelp size={18} /></button><button className="connection"><span className="status-dot" /> Motor local <ChevronDown size={14} /></button></div>
        </header>

        <div className="dashboard">
          <div className="hero">
            <div className="hero-copy"><div className="eyebrow"><span className="pulse" /> CIEL ESTÁ LISTO</div><h1>Tu espacio de trabajo,<br /><em>con superpoderes.</em></h1><p>Crea, conecta y automatiza cualquier cosa. <br />Siempre de forma local, privada y a tu manera.</p><div className="hero-actions"><button className="primary" onClick={() => document.getElementById("chat-input")?.focus()}><MessageSquare size={17} /> Hablar con Ciel</button><button className="secondary"><Boxes size={17} /> Explorar capacidades</button></div></div>
            <CielOrb />
          </div>

          <section className="quick-section"><div className="section-heading"><div><h2>¿Qué quieres crear?</h2><p>Empieza con una idea o elige una plantilla.</p></div><button className="view-all">Ver todo <span>→</span></button></div>
            <div className="cards">
              <QuickCard icon={Zap} color="purple" title="Automatiza una tarea" description="Conecta apps y crea flujos sin código." />
              <QuickCard icon={FolderKanban} color="teal" title="Inicia un proyecto" description="Prepara tu entorno de desarrollo." />
              <QuickCard icon={Bot} color="orange" title="Crea un agente" description="Diseña un asistente con tus reglas." />
              <QuickCard icon={Puzzle} color="blue" title="Conecta una herramienta" description="Añade un MCP, skill o integración." />
            </div>
          </section>

          <section className="activity-section"><div className="section-heading"><div><h2>Actividad reciente</h2><p>Todo lo que Ciel está haciendo por ti.</p></div><Activity size={18} className="muted-icon" /></div><div className="activity-row"><div className="activity-icon purple-bg"><Zap size={17} /></div><div className="activity-text"><strong>Resumen diario automatizado</strong><span>Ejecutado hace 12 minutos · Éxito</span></div><span className="tag running">ACTIVO</span><span className="more">•••</span></div><div className="activity-row"><div className="activity-icon teal-bg"><FolderKanban size={17} /></div><div className="activity-text"><strong>Proyecto “Ciel Desktop”</strong><span>Actualizado ayer · 4 archivos modificados</span></div><span className="tag project">PROYECTO</span><span className="more">•••</span></div></section>

          <section className="chat-card"><div className="chat-title"><div className="mini-orb"><Sparkles size={16} /></div><div><strong>Habla con Ciel</strong><span>Tu agente local está escuchando</span></div><span className="privacy"><span className="status-dot" /> Privado y local</span></div><div className="messages">{messages.slice(-3).map((message, index) => <div className={index % 2 === 0 ? "msg assistant" : "msg user"} key={`${message}-${index}`}>{message}</div>)}</div><div className="chat-input"><input id="chat-input" value={prompt} onChange={(event) => setPrompt(event.target.value)} onKeyDown={(event) => event.key === "Enter" && sendMessage()} placeholder="Dile a Ciel qué necesitas..." /><button onClick={sendMessage}><Sparkles size={17} /></button></div></section>
        </div>
      </section>
    </main>
  );
}

function QuickCard({ icon: Icon, color, title, description }: { icon: LucideIcon; color: string; title: string; description: string }) {
  return <button className="quick-card"><div className={`quick-icon ${color}`}><Icon size={19} /></div><div><strong>{title}</strong><span>{description}</span></div><span className="arrow">→</span></button>;
}

export default App;

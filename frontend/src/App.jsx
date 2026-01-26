import React, { useState, useEffect, useCallback } from "react";
import "./App.css";
import { API_URL } from "./Constants";
import Login from "./Login";
import Admin from "./Admin";
import Perfil from "./Perfil";

// Funções para o Calendário de Segundas-feiras
const getProximasSegundas = (formacao) => {
  const segundas = [];
  const dataLimite =
    formacao === "fullstack" ? new Date("2026-03-31") : new Date("2026-04-30");
  const hoje = new Date();
  let dia = new Date(hoje);

  // Ajusta para a próxima segunda
  dia.setDate(hoje.getDate() + ((1 + 7 - hoje.getDay()) % 7));

  while (dia <= dataLimite) {
    segundas.push(new Date(dia).toLocaleDateString("pt-BR"));
    dia.setDate(dia.getDate() + 7);
  }
  return segundas.slice(0, 4); // Mostra apenas as próximas 4 para não poluir
};

export default function App() {
  const [user, setUser] = useState(() => {
    const s = localStorage.getItem("gt3_session");
    if (!s) return null;
    try {
      const { userData, timestamp } = JSON.parse(s);
      if (Date.now() - timestamp < 12 * 60 * 60 * 1000) return userData;
    } catch (err) {
      console.error(err);
    }
    return null;
  });

  const [dadosSalvos, setDadosSalvos] = useState(() => {
    const salvo = localStorage.getItem("gt3_remember");
    return salvo ? JSON.parse(salvo) : null;
  });

  const [view, setView] = useState("home");
  const [form, setForm] = useState(dadosSalvos || { email: "", dataNasc: "" });
  const [historico, setHistorico] = useState([]);
  const [popup, setPopup] = useState({ show: false, msg: "", tipo: "" });
  const [feedback, setFeedback] = useState({
    nota: 0,
    revisao: "",
    modal: false,
  });

  const [isDarkMode, setIsDarkMode] = useState(() => {
    const salvo = localStorage.getItem("gt3_theme");
    return salvo ? JSON.parse(salvo) : true;
  });

  const [currentTime, setCurrentTime] = useState(
    new Date().toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    }),
  );

  const [alarmeAtivo] = useState(true);

  // ESTILO PERSONALIZADO PARA O POPUP TEAL/PRETO/BRANCO
  const popupStyles = {
    position: 'fixed',
    top: '20px',
    right: '20px',
    backgroundColor: '#008080', // Teal
    color: '#ffffff', // Branco
    padding: '15px 25px',
    borderRadius: '8px',
    boxShadow: '0 4px 15px rgba(0,0,0,0.3)',
    borderLeft: '5px solid #000000', // Preto
    zIndex: 9999,
    fontWeight: 'bold',
    animation: 'slideIn 0.5s ease-out'
  };

  const exibirPopup = (msg, tipo) => {
    setPopup({ show: true, msg, tipo });
    setTimeout(() => setPopup({ show: false, msg: "", tipo: "" }), 5000);
  };

  useEffect(() => {
    const timer = setInterval(() => {
      const agora = new Date();
      const horaFormatada = agora.toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
      });
      setCurrentTime(horaFormatada);

      // Lógica do alarme: Avisar às 18:30 nas segundas
      if (alarmeAtivo && agora.getDay() === 1 && horaFormatada === "18:30") {
        exibirPopup(
          "📢 Hora da aula! Não esqueça de fazer seu Check-in.",
          "aviso",
        );
      }
    }, 10000);
    return () => clearInterval(timer);
  }, [alarmeAtivo]);

  const validarHorarioPonto = () => {
    const agora = new Date();
    const diaSemana = agora.getDay(); // 1 é Segunda-feira
    const hora = agora.getHours();
    const minutos = agora.getMinutes();
    const horaDecimal = hora + minutos / 60;

    const isSegunda = diaSemana === 1;
    // Check-in: 18h às 20h30 (20.5)
    const podeCheckIn = isSegunda && horaDecimal >= 18 && horaDecimal <= 20.5;
    // Check-out: 22h às 22h30 (22.5)
    const podeCheckOut = isSegunda && horaDecimal >= 22 && horaDecimal <= 22.5;

    return { isSegunda, podeCheckIn, podeCheckOut };
  };

  const carregarHistorico = useCallback(async () => {
    if (!user?.email || user.role === "admin") return;
    try {
      const res = await fetch(`${API_URL}/historico/aluno/${user.email}`);
      if (res.ok) {
        const data = await res.json();
        setHistorico(data);
      }
    } catch {
      exibirPopup("Erro ao carregar histórico", "erro");
    }
  }, [user]);

  useEffect(() => {
    if (user?.email) {
      Promise.resolve().then(() => {
        carregarHistorico();
      });
    }
  }, [user?.email, carregarHistorico]);

  const handleLogin = async () => {
    try {
      const res = await fetch(`${API_URL}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: form.email,
          dataNascimento: form.dataNasc,
          formacao: form.formacao,
        }),
      });
      
      const data = await res.json();

      if (!res.ok) {
        exibirPopup(data.error || "Erro no login, tente novamente.", "erro");
        return;
      }

      // --- CONTROLE DE CONFLITO DE SESSÃO LOCAL ---
      localStorage.removeItem("gt3_session"); 
      // --------------------------------------------

      setUser(data);
      
      // Atualiza o "Lembrar-me" (Garante que campos nulos não quebrem o JSON)
      localStorage.setItem(
        "gt3_remember",
        JSON.stringify({
          email: data.email,
          dataNasc: data.data_nascimento,
          nome: data.nome || "",
          formacao: data.formacao,
        }),
      );

      // Define a sessão ativa
      localStorage.setItem(
        "gt3_session",
        JSON.stringify({ userData: data, timestamp: Date.now() }),
      );

    } catch (err) {
      console.error("Erro no login front:", err);
      exibirPopup("Erro de conexão com o servidor", "erro");
    }
  };

  const baterPonto = async (extra = {}) => {
    if (!user || !user.email) {
      exibirPopup("Sessão expirada. Por favor, faça login novamente.", "erro");
      return;
    }

    try {
      const res = await fetch(`${API_URL}/ponto`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          aluno_id: user.email.trim().toLowerCase(),
          ...extra,
        }),
      });
      const data = await res.json();
      
      if (!res.ok) {
        exibirPopup(data.error || "Erro ao registrar ponto.", "erro");
        return;
      }
      
      exibirPopup(data.msg, "sucesso");

      if (!extra.nota) { 
          setTimeout(() => {
            exibirPopup("📌 Lembrete: O Check-out deve ser hoje entre 22:00 e 22:30.", "aviso");
          }, 1000);
      }

      setFeedback({ nota: 0, revisao: "", modal: false });
      carregarHistorico();
    } catch (err) {
      console.error("Erro bater ponto:", err);
      exibirPopup("Erro de comunicação com o servidor.", "erro");
    }
  };

  useEffect(() => {
    document.body.classList.toggle("dark", isDarkMode);
    localStorage.setItem("gt3_theme", JSON.stringify(isDarkMode));
  }, [isDarkMode]);

  if (!user) {
    return (
      <Login
        form={form}
        setForm={setForm}
        handleLogin={handleLogin}
        dadosSalvos={dadosSalvos}
        setDadosSalvos={setDadosSalvos}
        isDarkMode={isDarkMode}
        setIsDarkMode={setIsDarkMode}
      />
    );
  }

  const hoje = new Date().toLocaleDateString("en-CA");
  const pontoHoje = historico.find((h) => h.data.split("T")[0] === hoje);
  const totalPresencas = historico.length;
  const totalFaltas = 0;

  // Lógica para exibir o e-mail caso o nome ainda não tenha sido preenchido no perfil
  const nomeExibicao = user.nome || user.email.split('@')[0];

  return (
    <div className="app-wrapper">
      {popup.show && (
        <div style={popupStyles} className="custom-popup-modern">
          {popup.msg}
        </div>
      )}

      <header className="glass-header">
        <div
          className="brand-logo"
          onClick={() => setView("home")}
          style={{ cursor: "pointer" }}
        >
          <div className="logo-circle">GT 3.0</div>
          <div className="brand-text">
            Registro de Frequência
            <span>Geração Tech 3.0</span>
          </div>
          <div className="user-badge">
            {user.role === "admin" ? "Admin" : "Aluno"}
          </div>
        </div>
        <div className="header-right">
          <span className="clock">🕒 {currentTime}</span>
          <div className="nav-actions">
            {user.role === "admin" && (
              <button
                className="btn-secondary"
                onClick={() => setView(view === "admin" ? "home" : "admin")}
              >
                {view === "admin" ? "Início" : "Painel Admin"}
              </button>
            )}
            <button
              className="btn-action-circle"
              onClick={() => setView("perfil")}
            >
              👤
            </button>
            <button
              className="btn-action-circle"
              title="Alternar Tema"
              onClick={() => setIsDarkMode(!isDarkMode)}
            >
              {isDarkMode ? "○" : "●"}
            </button>
            <button
              className="btn-secondary"
              onClick={() => {
                localStorage.removeItem("gt3_session");
                setUser(null);
              }}
            >
              Sair
            </button>
          </div>
        </div>
      </header>

      {view === "admin" && user.role === "admin" ? (
        <Admin />
      ) : view === "perfil" ? (
        <Perfil
          user={user}
          setUser={setUser}
          onVoltar={() => setView("home")}
        />
      ) : (
        <main className="content-grid">
          <div className="aula-card shadow-card">
            <div className="card-header-info">
              <p style={{ color: "var(--text-dim)" }}>
                {new Date().toLocaleDateString("pt-BR")}
              </p>
              <h2 style={{ color: "var(--text-dim)" }}>Olá, {nomeExibicao}!</h2>
            </div>

            <div
              className="info-banner"
              style={{
                color: "var(--text-dim)",
                border: "1px solid var(--border-subtle)",
              }}
            >
              ℹ Informação: Check-in e Check-out apenas para aulas ao vivo de segunda-feira.
            </div>

            <div style={{ margin: "20px 0", textAlign: "center" }}>
              {(() => {
                const { isSegunda, podeCheckIn, podeCheckOut } = validarHorarioPonto();

                if (!isSegunda) {
                  return (
                    <div className="info-banner" style={{ color: "var(--text-dim)", background: "transparent" }}>
                      ⚠️ O sistema de presença está fechado hoje.
                    </div>
                  );
                }

                if (!pontoHoje?.check_in) {
                  return (
                    <button
                      className="btn-ponto in"
                      onClick={() => podeCheckIn ? baterPonto() : exibirPopup("🕒 Janela de Check-in: 18:00 às 20:30.", "aviso")}
                    >
                      CHECK-IN
                    </button>
                  );
                }

                if (!pontoHoje?.check_out) {
                  return (
                    <button
                      className="btn-ponto out"
                      onClick={() => podeCheckOut ? setFeedback({ ...feedback, modal: true }) : exibirPopup("🕒 Janela de Check-out: 22:00 às 22:30.", "aviso")}
                    >
                      CHECK-OUT
                    </button>
                  );
                }

                return (
                  <div className="ponto-concluido">✔ Presença confirmada</div>
                );
              })()}
            </div>
            <p className="usability-info">
              Registro processado pelo horário de Brasília.
              <br /><br />
              <strong>🕒 Janela de Check-in:</strong> 18:00 às 20:30
              <br />
              <strong>🕒 Janela de Check-out:</strong> 22:00 às 22:30
            </p>
          </div>

          <div className="stats-grid">
            <div className="stat-card">
              <span className="stat-label">Total de Presenças</span>
              <div className="stat-value">{totalPresencas}</div>
            </div>

            <div className="stat-card" style={{ marginTop: "12px", textAlign: "left" }}>
              <span className="stat-label">📅 Próximas Aulas</span>
              <ul style={{ listStyle: "none", padding: 0, marginTop: "10px", fontSize: "0.85rem" }}>
                {getProximasSegundas(user.formacao).map((data, i) => (
                  <li key={i} style={{ marginBottom: "5px", color: "var(--text-normal)" }}>
                    ● {data} — 18:30h
                  </li>
                ))}
              </ul>
            </div>

            <div className="stat-card">
              <span className="stat-label">Total de Faltas</span>
              <div className="stat-value faltas">{totalFaltas}</div>
            </div>

            <div className="stat-card">
              <span className="stat-label">Status da Sessão</span>
              <div className="stat-value text-success" style={{ fontSize: "1.2rem" }}>Ativa</div>
            </div>
          </div>

          <div id="historico-section" className="historico-container shadow-card">
            <h3>Meu Histórico Completo</h3>
            <div className="table-responsive">
              <table className="historico-table">
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Entrada</th>
                    <th>Saída</th>
                  </tr>
                </thead>
                <tbody>
                  {historico.length === 0 ? (
                    <tr><td colSpan="3" style={{ textAlign: "center", color: "var(--text-dim)" }}>Nenhum registro encontrado.</td></tr>
                  ) : (
                    historico.map((h, i) => (
                      <tr key={i}>
                        <td>{new Date(h.data).toLocaleDateString("pt-BR", { timeZone: "UTC" })}</td>
                        <td>{h.check_in || "--:--"}</td>
                        <td>{h.check_out || "--:--"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      )}

      {feedback.modal && (
        <div className="modal-overlay">
          <div className="modal-content shadow-xl">
            <h3>Finalizar Check-out</h3>
            <p className="text-muted">Como foi sua experiência na aula de hoje?</p>
            <div className="rating-group" style={{ display: "flex", gap: "10px", margin: "15px 0", justifyContent: "center" }}>
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} className={feedback.nota === n ? "active" : ""} onClick={() => setFeedback({ ...feedback, nota: n })}>{n}</button>
              ))}
            </div>
            <textarea className="input-notes" placeholder="Algum comentário ou dúvida?" value={feedback.revisao} onChange={(e) => setFeedback({ ...feedback, revisao: e.target.value })} />
            <div style={{ display: "flex", gap: "10px", marginTop: "15px" }}>
              <button className="btn-ponto in" onClick={() => baterPonto({ nota: feedback.nota, revisao: feedback.revisao })}>Confirmar Saída</button>
              <button className="btn-secondary" onClick={() => setFeedback({ ...feedback, modal: false })}>Voltar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
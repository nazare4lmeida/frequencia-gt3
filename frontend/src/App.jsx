import React, { useState, useEffect, useCallback } from "react";
import "./App.css";
import { API_URL } from "./Constants";
import Login from "./Login";

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

  const [form, setForm] = useState(dadosSalvos || { email: "", dataNasc: "" });
  const [historico, setHistorico] = useState([]);
  const [popup, setPopup] = useState({ show: false, msg: "", tipo: "" });
  const [feedback, setFeedback] = useState({ nota: 0, revisao: "", modal: false });
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [alarmeAtivo, setAlarmeAtivo] = useState(false);

  // Inclusão: Estado para o relógio em tempo real
  const [currentTime, setCurrentTime] = useState(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));

  // Inclusão: Efeito para atualizar o relógio
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const exibirPopup = (msg, tipo) => {
    setPopup({ show: true, msg, tipo });
    setTimeout(() => setPopup({ show: false, msg: "", tipo: "" }), 5000);
  };

  const carregarHistorico = useCallback(async () => {
    if (!user?.id) return;
    try {
      const res = await fetch(`${API_URL}/historico/aluno/${user.id}`);
      if (res.ok) {
        const data = await res.json();
        setHistorico(data);
      }
    } catch {
      exibirPopup("Erro ao carregar histórico", "erro");
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      Promise.resolve().then(() => carregarHistorico());
    }
  }, [user, carregarHistorico]);

  const handleLogin = async () => {
    try {
      const res = await fetch(`${API_URL}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: form.email,
          dataNascimento: form.dataNasc,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        exibirPopup(data.error || "Erro no login", "erro");
        return;
      }
      setUser(data);
      localStorage.setItem("gt3_remember", JSON.stringify({ email: data.email, dataNasc: data.data_nascimento }));
      localStorage.setItem("gt3_session", JSON.stringify({ userData: data, timestamp: Date.now() }));
    } catch {
      exibirPopup("Erro de conexão com o servidor", "erro");
    }
  };

  const baterPonto = async (extra = {}) => {
    try {
      const res = await fetch(`${API_URL}/ponto`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          aluno_id: user.id,
          ...extra,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        exibirPopup(data.error || "Erro no ponto", "erro");
        return;
      }
      exibirPopup(data.msg, "sucesso");
      setFeedback({ nota: 0, revisao: "", modal: false });
      carregarHistorico();
    } catch {
      exibirPopup("Erro ao registrar ponto", "erro");
    }
  };

  useEffect(() => {
    const interval = setInterval(() => {
      const agora = new Date();
      if ((agora.getHours() === 17 || agora.getHours() === 21) && agora.getMinutes() === 55) {
        setAlarmeAtivo(true);
      }
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    document.body.classList.toggle("dark", isDarkMode);
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
  // Exemplo de cálculo de faltas (ajuste conforme sua regra de negócio)
  const totalFaltas = 0; 

  return (
    <div className="app-wrapper">
      {popup.show && <div className={`custom-popup ${popup.tipo}`}>{popup.msg}</div>}
      {alarmeAtivo && (
        <div className="alarme-box animate-pulse-glow">
          <p>⏰ 5 minutos para o ponto!</p>
          <button onClick={() => setAlarmeAtivo(false)}>Ok</button>
        </div>
      )}
      <header className="glass-header">
        <div className="brand-logo">
          <div className="logo-circle">GT 3.0</div>
          <div className="brand-text">
            Registro de Frequência
            <span>Geração Tech 3.0</span>
          </div>
          <div className="user-badge">{user.role === "admin" ? "Admin" : "Aluno"}</div>
        </div>
        <div className="header-right">
          <span className="clock">🕒 {currentTime}</span>
          <div className="nav-actions">
            <button
              className="btn-action-circle"
              title="Ver Histórico"
              onClick={() => document.getElementById("historico-section").scrollIntoView({ behavior: "smooth" })}
            >
              📊
            </button>
            <button className="btn-action-circle" title="Alternar Tema" onClick={() => setIsDarkMode(!isDarkMode)}>
              {isDarkMode ? "☀️" : "🌙"}
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
      <main className="content-grid">
        <div className="aula-card shadow-card">
          <div className="card-header-info">
            <p className="text-muted">{new Date().toLocaleDateString("pt-BR")}</p>
            <h2 className="text-teal-modern">Olá, {user.nome}!</h2>
          </div>

          {/* Inclusão: Banner Informativo sobre as aulas de segunda */}
          <div className="info-banner">
            ℹ Informação: Check-in e Check-out apenas para aulas ao vivo de segunda-feira.
          </div>

          <div style={{ margin: "20px 0" }}>
            {!pontoHoje?.check_in ? (
              <button className="btn-ponto in animate-pulse-glow" onClick={() => baterPonto()}>
                CHECK-IN
              </button>
            ) : !pontoHoje?.check_out ? (
              <button className="btn-ponto out" onClick={() => setFeedback({ ...feedback, modal: true })}>
                CHECK-OUT
              </button>
            ) : (
              <div className="ponto-concluido">✔ Presença confirmada</div>
            )}
          </div>
          <p className="usability-info">
            Seu registro será processado de acordo com o horário do servidor (Brasília). Certifique-se de realizar o
            check-out ao final da aula para validar sua participação.
          </p>
        </div>

        <div className="stats-grid">
          <div className="stat-card">
            <span className="stat-label">Total de Presenças</span>
            <div className="stat-value">{totalPresencas}</div>
          </div>
          
          {/* Inclusão: Bloco de Faltas */}
          <div className="stat-card">
            <span className="stat-label">Total de Faltas</span>
            <div className="stat-value faltas">{totalFaltas}</div>
          </div>

          <div className="stat-card">
            <span className="stat-label">Status da Sessão</span>
            <div className="stat-value text-success" style={{ fontSize: "1.2rem" }}>
              Ativa
            </div>
          </div>
        </div>

        <div id="historico-section" className="historico-container glass shadow-card">
          <div className="flex justify-between items-center mb-4">
            <h3>Meu Histórico Completo</h3>
          </div>
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
                  <tr>
                    <td colSpan="3" className="text-center text-muted">
                      Nenhum registro encontrado.
                    </td>
                  </tr>
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

      {feedback.modal && (
        <div className="modal-overlay">
          <div className="modal-content glass shadow-xl">
            <h3>Finalizar Check-out</h3>
            <p className="text-muted" style={{ marginBottom: "15px" }}>
              Como foi sua experiência na aula de hoje?
            </p>
            <div className="rating-group" style={{ display: "flex", gap: "10px", margin: "15px 0", justifyContent: "center" }}>
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  className={feedback.nota === n ? "active" : ""}
                  onClick={() => setFeedback({ ...feedback, nota: n })}
                >
                  {n}
                </button>
              ))}
            </div>
            <textarea
              className="input-notes"
              placeholder="Algum comentário ou dúvida sobre o conteúdo?"
              value={feedback.revisao}
              onChange={(e) => setFeedback({ ...feedback, revisao: e.target.value })}
            />
            <div style={{ display: "flex", gap: "10px", marginTop: "15px" }}>
              <button className="btn-primary" onClick={() => baterPonto({ nota: feedback.nota, revisao: feedback.revisao })}>
                Confirmar Saída
              </button>
              <button className="btn-secondary" onClick={() => setFeedback({ ...feedback, modal: false })}>
                Voltar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
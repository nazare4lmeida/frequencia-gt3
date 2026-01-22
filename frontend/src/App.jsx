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
      // Sessão de 12 horas para facilitar para os alunos
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
      // Salva apenas os dados básicos para o "lembrar"
      localStorage.setItem("gt3_remember", JSON.stringify({ email: data.email, dataNasc: data.data_nascimento }));
      localStorage.setItem(
        "gt3_session",
        JSON.stringify({ userData: data, timestamp: Date.now() }),
      );
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
        form={form} setForm={setForm}
        handleLogin={handleLogin}
        dadosSalvos={dadosSalvos} setDadosSalvos={setDadosSalvos}
        isDarkMode={isDarkMode} setIsDarkMode={setIsDarkMode}
      />
    );
  }

  const hoje = new Date().toLocaleDateString('en-CA'); // Pega YYYY-MM-DD local
  const pontoHoje = historico.find((h) => h.data.split('T')[0] === hoje);

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
        <div className="brand">
          <h1>GT <span>3.0</span></h1>
        </div>
        <button className="btn-secondary" onClick={() => { localStorage.removeItem("gt3_session"); setUser(null); }}>
          Sair
        </button>
      </header>

      <main className="content-grid">
        <div className="aula-card shadow-card">
          <p className="text-muted-foreground">{new Date().toLocaleDateString("pt-BR")}</p>
          <div style={{ margin: "20px 0" }}>
            {!pontoHoje?.check_in ? (
              <button className="btn-ponto in" onClick={() => baterPonto()}>CHECK-IN</button>
            ) : !pontoHoje?.check_out ? (
              <button className="btn-ponto out" onClick={() => setFeedback({ ...feedback, modal: true })}>CHECK-OUT</button>
            ) : (
              <div className="ponto-concluido">✔ Presença confirmada</div>
            )}
          </div>
        </div>

        <div className="historico-container glass shadow-card">
          <h3 style={{ marginBottom: "15px" }}>Meu Histórico</h3>
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
                {historico.map((h, i) => (
                  <tr key={i}>
                    <td>{new Date(h.data).toLocaleDateString("pt-BR", { timeZone: 'UTC' })}</td>
                    <td>{h.check_in || "--:--"}</td>
                    <td>{h.check_out || "--:--"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {feedback.modal && (
        <div className="modal-overlay">
          <div className="modal-content glass shadow-xl">
            <h3>Finalizar Check-out</h3>
            <p>Avalie a aula de hoje:</p>
            <div className="rating-group" style={{ display: "flex", gap: "10px", margin: "15px 0", justifyContent: "center" }}>
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} className={feedback.nota === n ? "active" : ""} onClick={() => setFeedback({ ...feedback, nota: n })}>{n}</button>
              ))}
            </div>
            <textarea
              className="input-notes"
              placeholder="O que achou da aula? (opcional)"
              value={feedback.revisao}
              onChange={(e) => setFeedback({ ...feedback, revisao: e.target.value })}
            />
            <div style={{ display: "flex", gap: "10px", marginTop: "15px" }}>
              <button className="btn-primary" onClick={() => baterPonto({ nota: feedback.nota, revisao: feedback.revisao })}>Confirmar</button>
              <button className="btn-secondary" onClick={() => setFeedback({ ...feedback, modal: false })}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
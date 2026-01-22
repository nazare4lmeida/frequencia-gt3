import React, { useState, useEffect } from "react";
import "./App.css";
import "./index.css";
import { API_URL } from "./Constants";
import Login from "./Login";

export default function App() {
  const [user, setUser] = useState(() => {
    const s = localStorage.getItem("gt3_session");
    if (!s) return null;
    try {
      const { userData, timestamp } = JSON.parse(s);
      if (Date.now() - timestamp < 30 * 60 * 1000) return userData;
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
  const [feedback, setFeedback] = useState({
    nota: 0,
    revisao: "",
    modal: false,
  });
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [alarmeAtivo, setAlarmeAtivo] = useState(false);

  const exibirPopup = (msg, tipo) => {
    setPopup({ show: true, msg, tipo });
    setTimeout(() => setPopup({ show: false, msg: "", tipo: "" }), 5000);
  };

  // 🔹 CARREGAR HISTÓRICO
  const carregarHistorico = React.useCallback(async () => {
    if (!user?.id) return;
    try {
      const res = await fetch(`${API_URL}/historico/aluno/${user.id}`);
      const data = await res.json();
      if (res.ok) setHistorico(data);
    } catch {
      exibirPopup("Erro ao carregar histórico", "erro");
    }
  }, [user]); // Alterado de [user?.id] para [user] para satisfazer o compilador

  // 🔹 LOGIN
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
      localStorage.setItem("gt3_remember", JSON.stringify(data));
      localStorage.setItem(
        "gt3_session",
        JSON.stringify({ userData: data, timestamp: Date.now() }),
      );
    } catch {
      exibirPopup("Erro de conexão com o servidor", "erro");
    }
  };

  // 🔹 REGISTRAR PONTO
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
      
      // Atualiza o histórico após bater o ponto
      carregarHistorico();
    } catch {
      exibirPopup("Erro ao registrar ponto", "erro");
    }
  };

  // 🔹 ALARME
  useEffect(() => {
    const interval = setInterval(() => {
      const agora = new Date();
      if (
        (agora.getHours() === 17 || agora.getHours() === 21) &&
        agora.getMinutes() === 55
      ) {
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

  const hoje = new Date().toISOString().split("T")[0];
  const pontoHoje = historico.find((h) => h.data === hoje);

  return (
    <div className="app-wrapper">
      {popup.show && (
        <div className={`custom-popup ${popup.tipo}`}>{popup.msg}</div>
      )}

      {alarmeAtivo && (
        <div className="alarme-box">
          <p>⏰ 5 minutos para o ponto!</p>
          <button onClick={() => setAlarmeAtivo(false)}>Ok</button>
        </div>
      )}

      <header>
        <div className="brand">
          <h1>GT <span>3.0</span></h1>
        </div>
        <button
          className="btn-secondary"
          onClick={() => {
            localStorage.clear();
            setUser(null);
          }}
        >
          Sair
        </button>
      </header>

      <main className="content-grid">
        <div className="aula-card">
          <p>{new Date().toLocaleDateString("pt-BR")}</p>

          {!pontoHoje?.check_in ? (
            <button className="btn-ponto in" onClick={() => baterPonto()}>
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

        <div className="historico-container">
          <h3 style={{ marginBottom: "15px" }}>Meu Histórico</h3>
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
                  <td>{new Date(h.data).toLocaleDateString("pt-BR")}</td>
                  <td>{h.check_in || "--:--"}</td>
                  <td>{h.check_out || "--:--"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>

      {feedback.modal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Finalizar Check-out</h3>
            <p>Avalie a aula de hoje:</p>
            <div className="rating-group" style={{ display: "flex", gap: "10px", margin: "15px 0" }}>
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
              placeholder="O que achou da aula? (opcional)"
              value={feedback.revisao}
              onChange={(e) => setFeedback({ ...feedback, revisao: e.target.value })}
            />
            <div style={{ display: "flex", gap: "10px" }}>
              <button 
                className="btn-primary" 
                onClick={() => baterPonto({ nota: feedback.nota, revisao: feedback.revisao })}
              >
                Confirmar Saída
              </button>
              <button 
                className="btn-secondary" 
                onClick={() => setFeedback({ ...feedback, modal: false })}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
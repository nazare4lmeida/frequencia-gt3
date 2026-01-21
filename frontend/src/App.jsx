import React, { useState, useEffect, useMemo, useCallback } from "react";
import "./App.css";
import { API_URL } from "./Constants";
import Login from "./Login";

export default function App() {
  // Inicialização estável do estado do usuário
  const [user, setUser] = useState(() => {
    const s = localStorage.getItem("gt3_session");
    if (s) {
      try {
        const { userData, timestamp } = JSON.parse(s);
        // Sessão expira em 30 minutos
        if (Date.now() - timestamp < 30 * 60 * 1000) return userData;
      } catch { return null; }
    }
    return null;
  });

  const [dadosSalvos, setDadosSalvos] = useState(() => {
    const salvo = localStorage.getItem("gt3_remember");
    return salvo ? JSON.parse(salvo) : null;
  });

  const [isDarkMode, setIsDarkMode] = useState(true);
  const [form, setForm] = useState(dadosSalvos || { email: "", dataNasc: "" });
  const [historico, setHistorico] = useState([]); 
  const [popup, setPopup] = useState({ show: false, msg: "", tipo: "" });
  const [feedback, setFeedback] = useState({
    nota: 0,
    revisao: "",
    modal: false,
  });
  const [alarmeAtivo, setAlarmeAtivo] = useState(false);

  // Calendário estendido até 30 de abril
  const segundas = useMemo(() => {
    const dates = [];
    let d = new Date("2026-01-26T12:00:00");
    const limite = new Date("2026-04-30T23:59:59");
    while (d <= limite) {
      dates.push(new Date(d).toLocaleDateString("pt-BR"));
      d.setDate(d.getDate() + 7);
    }
    return dates;
  }, []);

  // Memorizamos a função exibirPopup
  const exibirPopup = useCallback((msg, tipo) => {
    setPopup({ show: true, msg, tipo });
    setTimeout(() => setPopup({ show: false, msg: "", tipo: "" }), 5000);
  }, []);

  // carregarHistorico com segurança
  const carregarHistorico = useCallback(
    async (cpfManual) => {
      const targetCpf = cpfManual || user?.cpf;
      if (!targetCpf) return;
      try {
        const res = await fetch(`${API_URL}/historico/${targetCpf}`);
        const data = await res.json();
        if (res.ok) {
          setHistorico(data);
        }
      } catch {
        exibirPopup("Erro ao carregar histórico", "erro");
      }
    },
    [user?.cpf, exibirPopup],
  );

  // Alarme de 5 minutos antes da hora
  useEffect(() => {
    const checkAlarme = setInterval(() => {
      const agora = new Date();
      if (
        (agora.getHours() === 17 || agora.getHours() === 21) &&
        agora.getMinutes() === 55
      ) {
        setAlarmeAtivo(true);
        new Audio(
          "https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3",
        )
          .play()
          .catch(() => {});
      }
    }, 60000);
    return () => clearInterval(checkAlarme);
  }, []);

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
      if (res.ok) {
        setUser(data);
        localStorage.setItem("gt3_remember", JSON.stringify(data));
        const currentTimestamp = Date.now();
        localStorage.setItem(
          "gt3_session",
          JSON.stringify({
            userData: data,
            timestamp: currentTimestamp,
          }),
        );
        carregarHistorico(data.cpf);
      } else {
        exibirPopup(data.error, "erro");
      }
    } catch {
      exibirPopup("Erro de conexão", "erro");
    }
  };

  const baterPonto = async (dadosExtra = {}) => {
    try {
      const res = await fetch(`${API_URL}/ponto`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cpf: user.cpf,
          formacao: user.formacao,
          ...dadosExtra,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        exibirPopup(data.msg, "sucesso");
        setFeedback((prev) => ({ ...prev, modal: false }));
        carregarHistorico();
      } else {
        exibirPopup(data.error, "erro");
      }
    } catch {
      exibirPopup("Erro ao registrar ponto", "erro");
    }
  };

  useEffect(() => {
    isDarkMode
      ? document.body.classList.add("dark")
      : document.body.classList.remove("dark");
  }, [isDarkMode]);

  useEffect(() => {
  if (user?.cpf) {
    Promise.resolve().then(() => carregarHistorico());
  }
}, [user?.cpf, carregarHistorico]);

  if (!user)
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

  const pontoHoje = historico.find(
    (h) => h.data === new Date().toISOString().split("T")[0],
  );

  return (
    <div className="app-wrapper">
      {popup.show && (
        <div className={`custom-popup ${popup.tipo}`}>{popup.msg}</div>
      )}

      {alarmeAtivo && (
        <div className="alarme-box">
          <p>⏰ 5 minutos para o ponto!</p>
          <button onClick={() => setAlarmeAtivo(false)}>Desligar</button>
        </div>
      )}

      <header>
        <div className="brand">
          <h1>GT <span>3.0</span></h1>
        </div>
        <button
          className="btn-secondary"
          onClick={() => {
            localStorage.removeItem("gt3_session");
            setUser(null);
          }}
        >
          Sair
        </button>
      </header>

      <main className="content-grid">
        {/* CARD PRINCIPAL DE PONTO */}
        <div className="aula-card">
          <h3>{user.formacao?.toUpperCase()}</h3>
          <p>Aula de Hoje: {new Date().toLocaleDateString("pt-BR")}</p>
          <p style={{ fontSize: "0.7rem", opacity: 0.5 }}>
            Total de aulas no semestre: {segundas.length}
          </p>

          {!pontoHoje?.check_in ? (
            <button className="btn-ponto in" onClick={() => baterPonto()}>
              REALIZAR CHECK-IN
            </button>
          ) : !pontoHoje?.check_out ? (
            <button
              className="btn-ponto out"
              onClick={() => setFeedback((prev) => ({ ...prev, modal: true }))}
            >
              REALIZAR CHECK-OUT
            </button>
          ) : (
            <div className="ponto-concluido">✔ Presença confirmada!</div>
          )}
        </div>

        {/* TABELA DE HISTÓRICO RESTAURADA */}
        <div className="historico-container" style={{ marginTop: "40px" }}>
          <h2 style={{ marginBottom: "20px", fontSize: "1.2rem" }}>Meu Histórico</h2>
          <table className="historico-table">
            <thead>
              <tr>
                <th>Data</th>
                <th>Entrada</th>
                <th>Saída</th>
                <th>Nota</th>
              </tr>
            </thead>
            <tbody>
              {historico.length > 0 ? (
                historico.map((item, idx) => (
                  <tr key={idx}>
                    <td>
                      {new Date(item.data).toLocaleDateString("pt-BR", {
                        timeZone: "UTC",
                      })}
                    </td>
                    <td>
                      {item.check_in
                        ? new Date(item.check_in).toLocaleTimeString("pt-BR", { hour: '2-digit', minute: '2-digit' })
                        : "-"}
                    </td>
                    <td>
                      {item.check_out
                        ? new Date(item.check_out).toLocaleTimeString("pt-BR", { hour: '2-digit', minute: '2-digit' })
                        : "-"}
                    </td>
                    <td>{item.compreensao || "-"}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="4" style={{ textAlign: "center", opacity: 0.5 }}>
                    Nenhum registro encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </main>

      {/* MODAL DE FEEDBACK */}
      {feedback.modal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Finalizar Aula</h3>
            <p style={{ fontSize: "0.9rem", marginBottom: "15px" }}>Como foi sua compreensão hoje?</p>
            <div className="rating-group">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  onClick={() => setFeedback((prev) => ({ ...prev, nota: n }))}
                  className={feedback.nota === n ? "active" : ""}
                >
                  {n}
                </button>
              ))}
            </div>
            <textarea
              placeholder="O que revisar?"
              value={feedback.revisao}
              onChange={(e) =>
                setFeedback((prev) => ({ ...prev, revisao: e.target.value }))
              }
            />
            <button
              className="btn-save"
              onClick={() =>
                baterPonto({ nota: feedback.nota, feedback: feedback.revisao })
              }
            >
              SALVAR E SAIR
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
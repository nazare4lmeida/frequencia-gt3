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
        // Date.now() aqui é permitido pois é uma inicialização única de estado
        if (Date.now() - timestamp < 30 * 60 * 1000) return userData;
      } catch {
        return null;
      }
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

  // Calendário estendido (useMemo agora integrado para evitar avisos de 'unused')
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

  // Memorizamos a função exibirPopup para evitar o erro de 'cascading renders'
  const exibirPopup = useCallback((msg, tipo) => {
    setPopup({ show: true, msg, tipo });
    setTimeout(() => setPopup({ show: false, msg: "", tipo: "" }), 5000);
  }, []);

  // Memorizamos carregarHistorico com useCallback para que ele possa ser usado no useEffect com segurança
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

  // Alarme (sem alteração na lógica, apenas mantendo a limpeza)
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

  // handleLogin ajustado para criar o objeto de sessão de forma 'pura'
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

        // Resolvemos o erro 'impure function' criando o timestamp em uma variável constante
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
    if (!user?.cpf) return;

    const run = async () => {
      await carregarHistorico();
    };

    run();
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
          <h1>
            GT <span>3.0</span>
          </h1>
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
      </main>

      {feedback.modal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Finalizar Aula</h3>
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

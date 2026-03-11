import React, { useState, useEffect, useCallback } from "react";
import { API_URL } from "./Constants";

export default function HomeAdmin({ user }) {
  const [stats, setStats] = useState({
    totalAlunos: 0,
    sessoesAtivas: 0,
    concluidosHoje: 0,
    pendentesSaida: 0,
  });

  const [alunosNoPredio, setAlunosNoPredio] = useState([]);
  const [loading, setLoading] = useState(true);

  // --- CRONOGRAMA OFICIAL GTECH 3.0 ---
  const TEMAS_AULAS = {
    "02/03/2026": "Introdução à IA Generativa e Prompt Engineering",
    "09/03/2026": "Modelos de Linguagem (LLMs) e Aplicações Práticas",
    "16/03/2026": "Soft Skills: Comunicação Assertiva no Meio Tech",
    "23/03/2026": "IA aplicada à Produtividade e Automação",
    "30/03/2026": "Ética e Viés em Sistemas de Inteligência Artificial",
  };

  // Função para descobrir qual a próxima segunda-feira de aula
  const obterProximaAula = () => {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    const datasVivas = [
      "2026-03-02",
      "2026-03-09",
      "2026-03-16",
      "2026-03-23",
      "2026-03-30",
      "2026-04-06",
      "2026-04-13",
      "2026-04-22",
    ];

    const proxima = datasVivas.find((d) => new Date(d + "T12:00:00") >= hoje);

    if (!proxima) return { data: "--/--", pauta: "Fim do cronograma oficial." };

    const [ano, mes, dia] = proxima.split("-");
    const dataFormatada = `${dia}/${mes}/${ano}`;

    return {
      data: dataFormatada,
      pauta:
        TEMAS_AULAS[dataFormatada] ||
        "Tópico técnico conforme cronograma GTech.",
    };
  };

  const infoProximaAula = obterProximaAula();

  const carregarDashboard = useCallback(async () => {
    if (!user?.token) return;

    try {
      setLoading(true);
      const hoje = new Date().toISOString().split("T")[0];

      const resStats = await fetch(
        `${API_URL}/admin/stats/todos?dataFiltro=${hoje}`,
        {
          method: "GET",
          headers: { Authorization: `Bearer ${user.token}` },
        },
      );

      const resLista = await fetch(
        `${API_URL}/admin/busca?termo=&turma=todos&status=presentes_no_dia&dataFiltro=${hoje}`,
        {
          method: "GET",
          headers: { Authorization: `Bearer ${user.token}` },
        },
      );

      if (resStats.ok && resLista.ok) {
        const dataStats = await resStats.json();
        const dataLista = await resLista.json();

        setStats({
          totalAlunos: dataStats.totalAlunos || 0,
          sessoesAtivas: dataStats.sessoesAtivas || 0,
          concluidosHoje: dataStats.concluidosHoje || 0,
          pendentesSaida: dataStats.pendentesSaida || 0,
        });

        const noPredio = (dataLista.alunos || []).filter(
          (aluno) => !aluno.check_out,
        );
        setAlunosNoPredio(noPredio);
      }
    } catch (err) {
      console.error("Erro ao carregar dashboard admin:", err);
    } finally {
      setLoading(false);
    }
  }, [user, API_URL]);

  useEffect(() => {
    carregarDashboard();
    const interval = setInterval(carregarDashboard, 60000);
    return () => clearInterval(interval);
  }, [carregarDashboard]);

  // Lógica de contagem por turma ajustada para GTech
  const contagemFullstack = alunosNoPredio.filter(
    (a) => a.formacao === "fullstack",
  ).length;
  const contagemIAGen = alunosNoPredio.filter(
    (a) => a.formacao === "ia_generativa",
  ).length;
  const contagemIASoft = alunosNoPredio.filter(
    (a) => a.formacao === "ia_softskills",
  ).length;

  return (
    <div
      className="app-wrapper"
      style={{ maxWidth: "1200px", margin: "0 auto", padding: "20px" }}
    >
      {/* CABEÇALHO GERAÇÃO TECH */}
      <div
        className="shadow-card"
        style={{
          padding: "40px",
          marginBottom: "30px",
          background:
            "linear-gradient(135deg, var(--card-bg) 0%, rgba(0, 128, 128, 0.1) 100%)",
          borderLeft: "8px solid #008080",
          borderRadius: "15px",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
          }}
        >
          <div>
            <span
              style={{
                color: "#008080",
                fontWeight: "bold",
                textTransform: "uppercase",
                fontSize: "0.85rem",
                letterSpacing: "1px",
              }}
            >
              Painel de Controle • Geração Tech 3.0
            </span>
            <h1 style={{ margin: "10px 0", fontSize: "2.5rem" }}>
              Olá, {user?.nome?.split(" ")[0] || "Instrutor"}! 🚀
            </h1>
          </div>
          <button
            onClick={carregarDashboard}
            disabled={loading}
            className="btn-secondary"
            style={{
              background: "#008080",
              color: "white",
              border: "none",
              padding: "10px 20px",
              borderRadius: "8px",
              cursor: "pointer",
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? "..." : "🔄 Sincronizar Agora"}
          </button>
        </div>

        <div
          style={{
            marginTop: "35px",
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gap: "20px",
          }}
        >
          <div
            style={{
              background: "rgba(0,128,128,0.08)",
              padding: "20px",
              borderRadius: "12px",
              textAlign: "center",
              border: "1px solid rgba(0,128,128,0.1)",
            }}
          >
            <h4
              style={{
                marginTop: 0,
                fontSize: "0.75rem",
                color: "var(--text-dim)",
                textTransform: "uppercase",
              }}
            >
              Check-ins de Hoje
            </h4>
            <h2 style={{ fontSize: "2.8rem", margin: 0, color: "#008080" }}>
              {stats.sessoesAtivas}
            </h2>
            <p style={{ fontSize: "0.8rem", opacity: 0.7 }}>Alunos presentes</p>
          </div>

          <div
            style={{
              background: "rgba(245, 158, 11, 0.08)",
              padding: "20px",
              borderRadius: "12px",
              textAlign: "center",
              border: "1px solid rgba(245, 158, 11, 0.1)",
            }}
          >
            <h4
              style={{
                marginTop: 0,
                fontSize: "0.75rem",
                color: "var(--text-dim)",
                textTransform: "uppercase",
              }}
            >
              Check-outs Pendentes
            </h4>
            <h2 style={{ fontSize: "2.8rem", margin: 0, color: "#f59e0b" }}>
              {stats.pendentesSaida}
            </h2>
            <p style={{ fontSize: "0.8rem", opacity: 0.7 }}>
              Sessões em aberto
            </p>
          </div>

          <div
            style={{
              background: "rgba(255,255,255,0.03)",
              padding: "20px",
              borderRadius: "12px",
              textAlign: "center",
              border: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            <h4
              style={{
                marginTop: 0,
                fontSize: "0.75rem",
                color: "var(--text-dim)",
                textTransform: "uppercase",
              }}
            >
              Total de Alunos
            </h4>
            <h2 style={{ fontSize: "2.8rem", margin: 0 }}>
              {stats.totalAlunos}
            </h2>
            <p style={{ fontSize: "0.8rem", opacity: 0.7 }}>Base GTech 3.0</p>
          </div>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.5fr 1fr",
          gap: "25px",
        }}
      >
        {/* MONITOR EM TEMPO REAL */}
        <div
          className="shadow-card"
          style={{ padding: "25px", minHeight: "300px" }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "20px",
            }}
          >
            <h4 style={{ margin: 0, color: "#008080" }}>
              🟢 Alunos Ativos no Sistema
            </h4>

            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              <span
                style={{
                  fontSize: "0.7rem",
                  background: "rgba(0, 128, 128, 0.1)",
                  padding: "4px 10px",
                  borderRadius: "20px",
                  border: "1px solid #008080",
                  color: "#008080",
                }}
              >
                Fullstack: <strong>{contagemFullstack}</strong>
              </span>
              <span
                style={{
                  fontSize: "0.7rem",
                  background: "rgba(245, 158, 11, 0.1)",
                  padding: "4px 10px",
                  borderRadius: "20px",
                  border: "1px solid #f59e0b",
                  color: "#f59e0b",
                }}
              >
                IA Generativa: <strong>{contagemIAGen}</strong>
              </span>
              <span
                style={{
                  fontSize: "0.7rem",
                  background: "rgba(139, 92, 246, 0.1)",
                  padding: "4px 10px",
                  borderRadius: "20px",
                  border: "1px solid #8b5cf6",
                  color: "#8b5cf6",
                }}
              >
                IA + Soft Skills: <strong>{contagemIASoft}</strong>
              </span>
            </div>
          </div>

          <div
            style={{ display: "flex", flexDirection: "column", gap: "10px" }}
          >
            {alunosNoPredio.length > 0 ? (
              alunosNoPredio.map((aluno, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "12px",
                    background: "rgba(255,255,255,0.02)",
                    borderRadius: "10px",
                    borderLeft: `5px solid ${
                      aluno.formacao === "fullstack"
                        ? "#008080"
                        : aluno.formacao === "ia_generativa"
                          ? "#f59e0b"
                          : "#8b5cf6"
                    }`,
                  }}
                >
                  <div>
                    <div style={{ fontWeight: "bold", fontSize: "0.95rem" }}>
                      {aluno.nome}
                    </div>
                    <div
                      style={{ fontSize: "0.7rem", color: "var(--text-dim)" }}
                    >
                      {aluno.formacao_nome ||
                        (aluno.formacao === "fullstack"
                          ? "Web Full Stack"
                          : aluno.formacao === "ia_generativa"
                            ? "IA Generativa"
                            : "IA + Soft Skills")}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <span
                      style={{
                        color: "#008080",
                        fontSize: "0.9rem",
                        fontWeight: "bold",
                      }}
                    >
                      {aluno.check_in}
                    </span>
                    <div
                      style={{
                        fontSize: "0.6rem",
                        color: "var(--text-dim)",
                        textTransform: "uppercase",
                      }}
                    >
                      Entrada
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div style={{ textAlign: "center", padding: "60px" }}>
                <p style={{ color: "var(--text-dim)" }}>
                  Nenhum check-in registrado para hoje.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* COLUNA DE ENGAJAMENTO E CRONOGRAMA */}
        <div style={{ display: "flex", flexDirection: "column", gap: "25px" }}>
          <div
            className="shadow-card"
            style={{ padding: "25px", borderTop: "4px solid #008080" }}
          >
            <h4 style={{ margin: 0 }}>📊 Engajamento Global</h4>
            <div style={{ marginTop: "20px" }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: "8px",
                  fontSize: "0.9rem",
                }}
              >
                <span>Presença Hoje</span>
                <strong style={{ color: "#008080" }}>
                  {(
                    (stats.sessoesAtivas / (stats.totalAlunos || 1)) *
                    100
                  ).toFixed(0)}
                  %
                </strong>
              </div>
              <div
                style={{
                  background: "var(--border-subtle)",
                  height: "10px",
                  borderRadius: "5px",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: `${(stats.sessoesAtivas / (stats.totalAlunos || 1)) * 100}%`,
                    background: "#008080",
                    height: "100%",
                    transition: "width 1.5s ease-in-out",
                  }}
                />
              </div>
              <p
                style={{
                  fontSize: "0.7rem",
                  color: "var(--text-dim)",
                  marginTop: "10px",
                }}
              >
                Cálculo baseado no total de alunos ativos na plataforma.
              </p>
            </div>
          </div>

          <div
            className="shadow-card"
            style={{ padding: "25px", borderLeft: "4px solid #f59e0b" }}
          >
            <h4 style={{ marginBottom: "15px", color: "#f59e0b" }}>
              📅 Cronograma GTech
            </h4>
            <div
              style={{
                padding: "18px",
                background: "rgba(245,158,11,0.05)",
                borderRadius: "12px",
                border: "1px solid rgba(245,158,11,0.1)",
              }}
            >
              <span
                style={{
                  fontSize: "0.7rem",
                  fontWeight: "bold",
                  textTransform: "uppercase",
                  color: "#f59e0b",
                }}
              >
                Próximo Encontro
              </span>
              <h3 style={{ margin: "5px 0 10px 0", fontSize: "1.5rem" }}>
                {infoProximaAula.data}
              </h3>
              <p style={{ margin: 0, fontSize: "0.9rem", lineHeight: "1.4" }}>
                <strong>Pauta:</strong> {infoProximaAula.pauta}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

import React, { useState } from "react";
import { fetchComToken } from "./Api";
import { FORMACOES, obterAulasOcorridas } from "./Constants";
import Papa from "papaparse";
import * as XLSX from "xlsx";

export default function ImportacaoJustificativas({ setView, alunos = [] }) {
  const [arquivo, setArquivo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [cursoImportacao, setCursoImportacao] = useState("fullstack");

  const processarPlanilha = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setArquivo(file);
  };

  const enviarParaBackend = async (dados) => {
    let inseridos = 0;
    let atualizados = 0;
    let erros = 0;
    let ignorados = 0;

    console.log("🚀 INICIANDO IMPORTAÇÃO...");

    for (const [index, linha] of dados.entries()) {
      // 1. Extração de Email
      const email =
        (
          linha.email ||
          linha.aluno_email ||
          linha["Email"] ||
          linha["E-mail"] ||
          linha["Endereço de e-mail"] ||
          linha["seu e-mail"]
        )
          ?.toString()
          .trim()
          .toLowerCase() || null;

      if (!email) {
        ignorados++;
        continue;
      }

      // 2. Extração de Nome
      const nome =
        (
          linha.nome ||
          linha.nome_aluno ||
          linha.nome_x ||
          linha["Nome"] ||
          linha["Nome Completo"]
        )
          ?.toString()
          .trim() || null;

      // 3. Extração de Recorrência
      const recRaw =
        (
          linha.frequencia ||
          linha.recorrencia ||
          linha.tipo_recorrencia ||
          linha["Com que frequência isso vai acontecer?"]
        )
          ?.toString()
          .trim() || "";

      // 4. LÓGICA DE CURSO REFORMULADA (O PROBLEMA ESTÁ AQUI)
      // Pegamos o valor da linha ou do estado do componente
      const valorCursoBruto = (
        linha.formacao ||
        linha.curso ||
        cursoImportacao ||
        ""
      )
        .toString()
        .toLowerCase()
        .trim();

      let cursoFinal = "";
      if (valorCursoBruto.includes("full")) cursoFinal = "fullstack";
      else if (valorCursoBruto.includes("gen")) cursoFinal = "ia-gen";
      else if (
        valorCursoBruto.includes("soft") ||
        valorCursoBruto.includes("ss")
      )
        cursoFinal = "ia-soft";
      else cursoFinal = "fullstack"; // Fallback total para não travar o backend

      try {
        // DEBUG: Clique no objeto enviado no console do navegador para ver os valores reais
        const payload = {
          email,
          nome,
          formacao: cursoFinal, // Enviamos como 'formacao' para bater com o destructuring do seu backend
          recorrencia: recRaw,
        };

        const res = await fetchComToken(
          "/admin/importar-justificativa",
          "POST",
          payload,
        );
        console.log("LINHA ORIGINAL:", linha);
        console.log("PAYLOAD FINAL:", payload);
        const body = await res.json().catch(() => ({}));

        if (res.ok) {
          body.modo === "insert" ? inseridos++ : atualizados++;
        } else {
          // AQUI VOCÊ VAI VER O MOTIVO REAL NO CONSOLE
          console.error(
            `❌ ERRO NA LINHA ${index + 1} (${email}):`,
            body.error,
          );
          console.log("Payload enviado que deu erro:", payload);
          erros++;
        }
      } catch (err) {
        console.error("Falha na requisição:", err);
        erros++;
      }
    }

    alert(
      `Processamento concluído!\n` +
        `🆕 Inseridos: ${inseridos}\n` +
        `♻️ Atualizados: ${atualizados}\n` +
        `⏭️ Ignorados: ${ignorados}\n` +
        `❌ Erros: ${erros}`,
    );

    if (erros === 0 && (inseridos > 0 || atualizados > 0))
      window.location.reload();
  };

  const handleUpload = () => {
    if (!arquivo) return alert("Selecione um arquivo primeiro!");
    setLoading(true);
    const extensao = arquivo.name.split(".").pop().toLowerCase();

    if (extensao === "xlsx" || extensao === "xls") {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: "array" });
          const json = XLSX.utils.sheet_to_json(
            workbook.Sheets[workbook.SheetNames[0]],
          );
          await enviarParaBackend(json);
        } catch {
          alert("Erro ao ler arquivo Excel.");
        } finally {
          setLoading(false);
          setArquivo(null);
        }
      };
      reader.readAsArrayBuffer(arquivo);
    } else if (extensao === "csv") {
      Papa.parse(arquivo, {
        header: true,
        skipEmptyLines: true,
        complete: async (results) => {
          await enviarParaBackend(results.data);
          setLoading(false);
          setArquivo(null);
        },
        error: () => {
          alert("Erro ao ler arquivo CSV.");
          setLoading(false);
        },
      });
    } else {
      alert("Formato não suportado. Use .csv, .xlsx ou .xls");
      setLoading(false);
    }
  };

  const exportarRelatorioConsolidado = () => {
    if (!alunos || alunos.length === 0)
      return alert("Nenhum dado disponível. Acesse a Auditoria primeiro.");

    const calcularFaltas = (a) => {
      const totalAulas = obterAulasOcorridas(a.formacao);
      const presencasValidas = Math.min(a.total_presencas || 0, totalAulas);
      const faltasBrutas = Math.max(0, totalAulas - presencasValidas);
      if (a.se_ausenta_sempre)
        return {
          totalAulas,
          presencasValidas,
          faltasFinais: 0,
          status: "ABONADO",
        };
      const faltasFinais = Math.max(0, faltasBrutas - (a.saldo_abonos || 0));
      const pct = totalAulas > 0 ? (faltasFinais / totalAulas) * 100 : 0;
      return {
        totalAulas,
        presencasValidas,
        faltasFinais,
        status: pct === 0 ? "REGULAR" : pct <= 25 ? "ATENÇÃO" : "CRÍTICO",
      };
    };

    const cabecalho =
      "Nome;Email;Formação;Aulas Dadas;Presenças;Faltas;Abonos;Faltas Finais;Justificou Forms?;Status\n";
    const linhas = alunos
      .map((a) => {
        const { totalAulas, presencasValidas, faltasFinais, status } =
          calcularFaltas(a);
        const faltasBrutas = Math.max(0, totalAulas - presencasValidas);
        const abonos = a.se_ausenta_sempre ? faltasBrutas : a.saldo_abonos || 0;
        const justificou =
          a.se_ausenta_sempre || a.saldo_abonos > 0 ? "SIM" : "NÃO";
        return [
          a.nome || "Sem Nome",
          a.email,
          a.formacao_nome || a.formacao || "",
          totalAulas,
          presencasValidas,
          faltasBrutas,
          abonos,
          faltasFinais,
          justificou,
          status,
        ].join(";");
      })
      .join("\n");

    const blob = new Blob(["\ufeff" + cabecalho + linhas], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute(
      "download",
      `relatorio_gtech_${new Date().toISOString().slice(0, 10)}.csv`,
    );
    link.click();
  };

  return (
    <div className="app-wrapper">
      <div
        className="shadow-card"
        style={{ maxWidth: "800px", margin: "0 auto" }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "20px",
          }}
        >
          <h3 style={{ color: "var(--teal-primary)", margin: 0 }}>
            📥 Importar Justificativas
          </h3>
          <button onClick={() => setView("limpeza")} className="btn-secondary">
            Ir para Gestão Rápida
          </button>
        </div>

        <p
          style={{
            fontSize: "0.9rem",
            color: "var(--text-dim)",
            marginBottom: "20px",
          }}
        >
          O sistema identifica se a ausência é única ou recorrente e abona
          automaticamente. Aceita formatos .csv, .xlsx e .xls.
        </p>

        <div style={{ marginBottom: "20px" }}>
          <label
            style={{
              fontSize: "0.85rem",
              color: "var(--text-dim)",
              display: "block",
              marginBottom: "8px",
            }}
          >
            Formação dos alunos nesta planilha:
          </label>
          <select
            className="input-modern"
            style={{ width: "100%", margin: 0 }}
            value={cursoImportacao}
            onChange={(e) => setCursoImportacao(e.target.value)}
          >
            <option value="fullstack">Fullstack Developer</option>
            <option value="ia-gen">IA Generativa</option>
            <option value="ia-soft">IA Soft</option>
          </select>
        </div>

        <div
          style={{
            margin: "20px 0",
            padding: "40px 20px",
            border: "2px dashed rgba(0,128,128,0.3)",
            borderRadius: "16px",
            textAlign: "center",
            backgroundColor: "rgba(0,128,128,0.02)",
          }}
        >
          <input
            type="file"
            id="file-upload"
            accept=".csv,.xlsx,.xls"
            onChange={processarPlanilha}
            style={{ display: "none" }}
          />
          <label
            htmlFor="file-upload"
            className="btn-secondary"
            style={{
              display: "inline-block",
              cursor: "pointer",
              padding: "12px 24px",
              border: "1px solid var(--teal-primary)",
              color: "var(--teal-primary)",
              marginBottom: "15px",
              fontWeight: "600",
            }}
          >
            {arquivo
              ? "📁 Arquivo Selecionado"
              : "📎 Escolher Planilha (CSV ou Excel)"}
          </label>
          {arquivo && (
            <p
              style={{
                fontSize: "0.85rem",
                color: "var(--teal-primary)",
                marginBottom: "15px",
              }}
            >
              <strong>Arquivo:</strong> {arquivo.name}
            </p>
          )}
          <br />
          <button
            onClick={handleUpload}
            className="btn-ponto in"
            disabled={loading || !arquivo}
            style={{
              width: "100%",
              maxWidth: "300px",
              marginTop: "10px",
              opacity: loading || !arquivo ? 0.6 : 1,
            }}
          >
            {loading ? "Processando..." : "CONFIRMAR IMPORTAÇÃO"}
          </button>
        </div>

        <hr style={{ margin: "40px 0", opacity: 0.1 }} />

        <div style={{ textAlign: "center" }}>
          <h4 style={{ marginBottom: "10px" }}>Relatórios</h4>
          <button
            onClick={exportarRelatorioConsolidado}
            className="btn-secondary"
            style={{
              width: "100%",
              maxWidth: "350px",
              border: "1px solid var(--teal-primary)",
              color: "var(--teal-primary)",
            }}
          >
            📊 Exportar Planilha Consolidada ({alunos.length} alunos)
          </button>
        </div>
      </div>
    </div>
  );
}

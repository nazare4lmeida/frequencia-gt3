import React, { useState } from "react";
import { fetchComToken } from "./Api";
import Papa from "papaparse"; 
import * as XLSX from "xlsx"; // Certifique-se de ter rodado: npm install xlsx

export default function ImportacaoJustificativas({ setView, alunos = [] }) {
  const [arquivo, setArquivo] = useState(null);
  const [loading, setLoading] = useState(false);

  const processarPlanilha = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setArquivo(file);
  };

  const enviarParaBackend = async (dados) => {
    let importados = 0;
    for (const linha of dados) {
      // MAPEAMENTO FLEXÍVEL: Identifica as colunas independente do formato (CSV ou Excel)
      const nome = (linha.nome_x || linha.nome || linha["Nome Completo"] || linha["Nome"])?.trim();
      const recorrencia = (linha.frequencia || linha.recorrencia || linha["Com que frequência isso vai acontecer?"])?.toString().toLowerCase() || "";
      const email = linha.email?.trim().toLowerCase() || linha["Endereço de e-mail"]?.trim().toLowerCase() || null;

      if (!nome && !email) continue;

      try {
        await fetchComToken("/admin/importar-justificativa", "POST", {
          email,
          nome,
          curso: "fullstack", // Padrão
          recorrencia, 
        });
        importados++;
      } catch (err) {
        console.error(`Erro no registro:`, err);
      }
    }
    alert(`Processamento concluído! ${importados} registros processados.`);
  };

  const handleUpload = () => {
    if (!arquivo) return alert("Selecione um arquivo primeiro!");
    setLoading(true);

    const extensao = arquivo.name.split(".").pop().toLowerCase();

    // LÓGICA PARA EXCEL (.xlsx ou .xls)
    if (extensao === "xlsx" || extensao === "xls") {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: "array" });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const json = XLSX.utils.sheet_to_json(worksheet);
          await enviarParaBackend(json);
        } catch {
          alert("Erro ao ler arquivo Excel.");
        } finally {
          setLoading(false);
          setArquivo(null);
        }
      };
      reader.readAsArrayBuffer(arquivo);
    } 
    // LÓGICA PARA CSV
    else if (extensao === "csv") {
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
        }
      });
    } else {
      alert("Formato não suportado. Use .csv, .xlsx ou .xls");
      setLoading(false);
    }
  };

  const exportarRelatorioConsolidado = () => {
    if (!alunos || alunos.length === 0) return alert("Nenhum dado disponível para exportar.");
    
    const cabecalho = "Nome Completo;Curso;Presencas;Faltas;Justificou Forms?;Status\n";
    const linhas = alunos.map(aluno => {
      const justificativa = (aluno.se_ausenta_sempre || aluno.saldo_abonos > 0) ? "SIM" : "NÃO";
      const statusFinal = aluno.se_ausenta_sempre ? "ABONADO" : (aluno.saldo_abonos > 0 ? `ABONOS: ${aluno.saldo_abonos}` : "");
      
      return `${aluno.nome || "Sem Nome"};${aluno.formacao_nome || ""};${aluno.total_presencas || 0};${aluno.total_faltas || 0};${justificativa};${statusFinal}`;
    }).join("\n");

    const blob = new Blob(["\ufeff" + cabecalho + linhas], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `relatorio_consolidado_frequencia.csv`);
    link.click();
  };

  return (
    <div className="app-wrapper">
      <div className="shadow-card" style={{ maxWidth: "800px", margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
          <h3 style={{ color: "var(--teal-primary)", margin: 0 }}>📥 Importar Justificativas</h3>
          <button onClick={() => setView("admin")} className="btn-secondary">Voltar ao Painel</button>
        </div>

        <p style={{ fontSize: "0.9rem", color: "var(--text-dim)", marginBottom: "30px" }}>
          O sistema identificará se a ausência é única ou recorrente e abonará automaticamente. 
          Aceita formatos <strong>.csv</strong>, <strong>.xlsx</strong> e <strong>.xls</strong>.
        </p>

        {/* AREA DE UPLOAD ESTILIZADA */}
        <div style={{ 
          margin: "20px 0", 
          padding: "40px 20px", 
          border: "2px dashed rgba(0, 128, 128, 0.3)", 
          borderRadius: "16px", 
          textAlign: "center",
          backgroundColor: "rgba(0, 128, 128, 0.02)"
        }}>
          {/* Input invisível */}
          <input 
            type="file" 
            id="file-upload"
            accept=".csv, .xlsx, .xls" 
            onChange={processarPlanilha} 
            style={{ display: "none" }} 
          />
          
          {/* Label estilizado como botão */}
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
              transition: "all 0.3s",
              fontWeight: "600"
            }}
          >
            {arquivo ? "📁 Arquivo Selecionado" : "📎 Escolher Planilha (CSV ou Excel)"}
          </label>

          {arquivo && (
            <p style={{ fontSize: "0.85rem", color: "var(--teal-primary)", marginBottom: "15px" }}>
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
              opacity: (loading || !arquivo) ? 0.6 : 1
            }}
          >
            {loading ? "Processando..." : "CONFIRMAR IMPORTAÇÃO"}
          </button>
        </div>

        <hr style={{ margin: "40px 0", opacity: 0.1 }} />

        <div style={{ textAlign: "center" }}>
          <h4 style={{ marginBottom: "10px" }}>Relatórios</h4>
          <p style={{ fontSize: "0.8rem", color: "var(--text-dim)", marginBottom: "20px" }}>
            Gere a planilha completa com alunos, faltas, presenças e abonos atualizados.
          </p>
          <button 
            onClick={exportarRelatorioConsolidado} 
            className="btn-secondary" 
            style={{ 
              width: "100%", 
              maxWidth: "350px", 
              backgroundColor: "transparent",
              border: "1px solid rgba(255,255,255,0.2)"
            }}
          >
            📊 Exportar Planilha Consolidada
          </button>
        </div>
      </div>
    </div>
  );
}
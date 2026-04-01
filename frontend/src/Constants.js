export const API_URL =
  window.location.hostname === "localhost" ? "http://localhost:3001/api" : "/api";

// IDs devem bater exatamente com o campo `formacao` salvo no banco
export const FORMACOES = [
  { id: "fullstack",  nome: "Fullstack Developer", tag: "WEB"  },
  { id: "ia-gen",    nome: "IA Generativa",        tag: "AI"   },
  { id: "ia-soft",   nome: "IA + Soft Skills",     tag: "SOFT" },
];

// Cronogramas oficiais GTech 3.0 — fonte única da verdade para frontend e backend
export const CRONOGRAMAS = {
  fullstack: ["2026-02-02", "2026-02-13", "2026-02-16", "2026-02-23"],
  "ia-gen":  [
    "2026-02-02", "2026-02-09", "2026-02-23",
    "2026-03-02", "2026-03-09", "2026-03-16",
    "2026-03-23", "2026-03-30", "2026-04-06", "2026-04-13",
  ],
  "ia-soft": [
    "2026-02-02", "2026-02-09", "2026-02-23",
    "2026-03-02", "2026-03-09", "2026-03-16",
    "2026-03-23", "2026-03-30", "2026-04-06", "2026-04-13",
  ],
};

export const getNomeFormacao = (id) =>
  FORMACOES.find((f) => f.id === id)?.nome || "Não informada";

// Retorna as datas do cronograma que já ocorreram (após as 18:30)
export const obterDatasOcorridas = (formacaoId) => {
  const agora = new Date();
  const datas = CRONOGRAMAS[formacaoId] || [];
  return datas.filter((d) => new Date(d + "T18:30:00") <= agora);
};

// Retorna a contagem de aulas já ocorridas para uma formação
export const obterAulasOcorridas = (formacaoId) =>
  obterDatasOcorridas(formacaoId).length;

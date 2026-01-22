export const API_URL = 
  window.location.hostname === "localhost" ? "http://localhost:3001/api" : "/api";

export const FORMACOES = [
  { id: "fullstack", nome: "Fullstack Developer", tag: "WEB" },
  { id: "ia-gen", nome: "IA Generativa", tag: "AI" },
  { id: "ia-soft", nome: "IA + Soft Skills", tag: "SOFT" },
];

// Sugestão: Função rápida para pegar o nome da formação
export const getNomeFormacao = (id) => {
  return FORMACOES.find(f => f.id === id)?.nome || "Não informada";
};
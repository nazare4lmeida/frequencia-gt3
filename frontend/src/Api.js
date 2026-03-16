import { API_URL } from "./Constants";

/**
 * Função utilitária para fazer requisições autenticadas
 * @param {string} endpoint - O caminho da rota (ex: '/ponto')
 * @param {string} method - GET, POST, PUT, DELETE
 * @param {object} body - Dados para enviar (opcional)
 */
export const fetchComToken = async (endpoint, method = "GET", body = null) => {
  // 1. Busca a sessão atualizada para pegar o token
  const sessionData = localStorage.getItem("gt3_session");
  const session = sessionData ? JSON.parse(sessionData) : null;
  const token = session?.userData?.token;

  const headers = {
    "Content-Type": "application/json",
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const config = {
    method,
    headers,
  };

  if (body) {
    config.body = JSON.stringify(body);
  }

  try {
    const res = await fetch(`${API_URL}${endpoint}`, config);

    // 2. TRATAMENTO GLOBAL DE ERRO 401 (TOKEN EXPIRADO)
    if (res.status === 401) {
      localStorage.removeItem("gt3_session");
      window.location.reload(); // Força o refresh para voltar ao login
      return res;
    }

    // 3. TRATAMENTO GLOBAL DE ERRO 403 (ACESSO PROIBIDO/NEGADO)
    // Se cair aqui, o aluno está logado, mas o servidor negou a ação específica.
    if (res.status === 403) {
      console.error("Erro 403: O usuário não tem permissão para esta ação ou está fora dos requisitos (ex: geolocalização ou horário).");
      // Você pode retornar a resposta para tratar o alerta específico na tela de check-in
      return res; 
    }

    return res;
  } catch (error) {
    console.error("Erro na requisição:", error);
    throw error;
  }
};
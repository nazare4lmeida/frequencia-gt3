import { API_URL } from "./Constants";

/**
 * Função utilitária para fazer requisições autenticadas
 * @param {string} endpoint - O caminho da rota (ex: '/ponto')
 * @param {string} method - GET, POST, PUT, DELETE
 * @param {object} body - Dados para enviar (opcional)
 */
export const fetchComToken = async (endpoint, method = "GET", body = null) => {
  // CORREÇÃO: A chave correta usada no seu App.js é "gtech_session"
  const sessionData = localStorage.getItem("gtech_session");
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

    // 2. TRATAMENTO GLOBAL DE ERRO 401 (TOKEN EXPIRADO OU AUSENTE)
    if (res.status === 401) {
      localStorage.removeItem("gtech_session");
      window.location.reload(); 
      return res;
    }

    // 3. TRATAMENTO GLOBAL DE ERRO 403 (ACESSO NEGADO PELO BACKEND)
    if (res.status === 403) {
      console.error("Erro 403: Acesso negado. Verifique permissões ou requisitos.");
      return res; 
    }

    return res;
  } catch (error) {
    console.error("Erro na requisição:", error);
    throw error;
  }
};
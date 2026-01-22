import React from "react";
import { FORMACOES } from "./Constants";

export default function Login({
  form,
  setForm,
  handleLogin,
  dadosSalvos,
  setDadosSalvos,
  isDarkMode,
  setIsDarkMode,
}) {
  const toggleTheme = () => setIsDarkMode((prev) => !prev);

  const handleUseAnotherAccount = () => {
    localStorage.removeItem("gt3_remember");
    setDadosSalvos(null);
    setForm({ email: "", dataNasc: "", formacao: "" });
  };

  const handleChange = (field) => (e) => {
    setForm({ ...form, [field]: e.target.value });
  };

  return (
    <div className="login-container">
      {/* Botão de Tema Reposicionado via classe theme-toggle */}
      <button className="btn-action-circle theme-toggle" onClick={toggleTheme} style={{ position: 'fixed', top: '20px', right: '20px', zIndex: 1000 }}>
        {isDarkMode ? "○" : "●"}
      </button>

      <div className="login-card">
        {/* Removido o logo-container com GT 3.0 que ficava acima do h1 */}

        <h1>Registro de Frequência</h1>
        <p className="subtitle">Geração Tech 3.0</p>

        {dadosSalvos ? (
          <div className="welcome-back">
            <p>● Bem-vindo(a) de volta,</p>
            {/* Correção: Se o nome não existir, mostra o email para não ficar vazio */}
            <div className="user-name-badge">{dadosSalvos.nome || dadosSalvos.email}</div>
            <p className="text-muted" style={{fontSize: '0.8rem', marginBottom: '15px'}}>
              Turma: {FORMACOES.find(f => f.id === dadosSalvos.formacao)?.nome || "Não definida"}
            </p>

            <button onClick={handleLogin} className="btn-ponto in">
              Confirmar e Entrar
            </button>

            <button onClick={handleUseAnotherAccount} className="btn-ghost">
              Usar outra conta
            </button>
          </div>
        ) : (
          <div className="login-form">
            <input
              type="email"
              className="input-modern"
              placeholder="E-mail cadastrado"
              value={form.email}
              onChange={handleChange("email")}
            />
            <input
              type="date"
              className="input-modern"
              value={form.dataNasc}
              onChange={handleChange("dataNasc")}
            />
            
            <select 
              className="input-modern" 
              value={form.formacao} 
              onChange={handleChange("formacao")}
              style={{ appearance: 'none' }}
            >
              <option value="">Selecione sua Formação</option>
              {FORMACOES.map(f => (
                <option key={f.id} value={f.id}>{f.nome}</option>
              ))}
            </select>

            <button onClick={handleLogin} className="btn-ponto in" disabled={!form.formacao}>
              Entrar no Portal
            </button>
          </div>
        )}

        <p className="usability-info">
          Utilize suas credenciais cadastradas no programa. Em caso de primeiro
          acesso, sua senha padrão é sua data de nascimento.
        </p>
      </div>
    </div>
  );
}
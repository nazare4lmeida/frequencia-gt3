import React from "react";

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
    setForm({ email: "", dataNasc: "" });
  };

  const handleChange = (field) => (e) => {
    setForm({ ...form, [field]: e.target.value });
  };

  return (
    <div className="login-container">
      <button
        className="btn-action-circle theme-toggle"
        onClick={toggleTheme}
        title="Alternar Tema"
      >
        {isDarkMode ? "☀️" : "🌙"}
      </button>

      <div className="login-card">
        <div className="logo-container">
          <div className="logo-badge">GT 3.0</div>
        </div>

        <h1>Registro de Frequência</h1>
        <p className="subtitle">Geração Tech 3.0</p>

        {dadosSalvos ? (
          <div className="welcome-back">
            <p>● Bem-vindo de volta,</p>
            <div className="user-name-badge">
              {dadosSalvos.nome}
            </div>

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
            <button onClick={handleLogin} className="btn-ponto in">
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
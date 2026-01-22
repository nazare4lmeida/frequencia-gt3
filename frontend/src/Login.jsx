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
  const toggleTheme = () => {
    setIsDarkMode((prev) => !prev);
  };

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
      {/* Botão de tema */}
      <button
        className="btn-action-circle"
        style={{ position: "fixed", top: 20, right: 20 }}
        onClick={toggleTheme}
        title="Alternar Tema"
      >
        {isDarkMode ? "☀️" : "🌙"}
      </button>

      <div className="login-card">
        {/* Logo / Marca */}
        <div style={{ marginBottom: "16px" }}>
          <div
            style={{
              backgroundColor: "var(--teal-dark)",
              color: "#fff",
              padding: "8px 16px",
              borderRadius: "10px",
              fontWeight: 800,
              display: "inline-block",
              boxShadow: "0 0 15px rgba(20, 184, 166, 0.25)",
            }}
          >
            GT 3.0
          </div>
        </div>

        {/* Título */}
        <h1 style={{ fontSize: "1.8rem", marginBottom: "4px" }}>
          Registro de Frequência
        </h1>
        <p style={{ color: "var(--muted)", marginBottom: "24px" }}>
          Geração Tech 3.0
        </p>

        {/* Conteúdo */}
        {dadosSalvos ? (
          <div style={{ textAlign: "center" }}>
            <p style={{ marginBottom: "6px" }}>
              ● Bem-vindo de volta,
            </p>

            <div
              style={{
                display: "inline-block",
                marginBottom: "16px",
                padding: "6px 14px",
                borderRadius: "999px",
                backgroundColor: "#1e293b",
                border: "1px solid hsl(var(--border))",
                fontWeight: 600,
              }}
            >
              {dadosSalvos.nome}
            </div>

            <button
              onClick={handleLogin}
              style={primaryButton}
            >
              Confirmar e Entrar
            </button>

            <button
              onClick={handleUseAnotherAccount}
              style={ghostButton}
            >
              Usar outra conta
            </button>
          </div>
        ) : (
          <div>
            <div style={{ marginBottom: "12px" }}>
              <input
                type="email"
                placeholder="E-mail cadastrado"
                value={form.email}
                onChange={handleChange("email")}
                style={inputStyle}
              />
            </div>

            <div style={{ marginBottom: "20px" }}>
              <input
                type="date"
                value={form.dataNasc}
                onChange={handleChange("dataNasc")}
                style={inputStyle}
              />
            </div>

            <button
              onClick={handleLogin}
              style={primaryButton}
            >
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

/* ========================= */
/* Estilos auxiliares (JS)   */
/* ========================= */

const inputStyle = {
  width: "100%",
  padding: "12px",
  borderRadius: "8px",
  border: "1px solid hsl(var(--border))",
  backgroundColor: "#020617",
  color: "#fff",
  fontSize: "0.9rem",
};

const primaryButton = {
  width: "100%",
  height: "44px",
  borderRadius: "10px",
  backgroundColor: "var(--teal-brand)",
  color: "#fff",
  fontWeight: 700,
  border: "none",
  cursor: "pointer",
  marginBottom: "10px",
};

const ghostButton = {
  width: "100%",
  background: "none",
  border: "none",
  color: "#94a3b8",
  fontSize: "0.75rem",
  cursor: "pointer",
};

import React from "react";

export default function Login({
  form,
  setForm,
  handleLogin,
  dadosSalvos,
  setDadosSalvos,
  isDarkMode,
  setIsDarkMode
}) {
  return (
    <div className="login-container">
      {/* Botão de Tema no Topo (Direita conforme o X) */}
      <button
        className="btn-action-circle theme-toggle"
        style={{ position: 'fixed', top: '20px', right: '20px' }}
        onClick={() => setIsDarkMode(!isDarkMode)}
        title="Alternar Tema"
      >
        {isDarkMode ? "☀️" : "🌙"}
      </button>

      <div className="login-card glass shadow-xl">
        <div className="brand-logo" style={{ justifyContent: 'center', marginBottom: '10px' }}>
          <div className="logo-circle">GT 3.0</div>
        </div>
        
        <div className="login-header">
          <h1 className="brand-text" style={{ fontSize: '1.8rem' }}>
            Registro de Frequência
          </h1>
          <p className="login-subtitle">Geração Tech 3.0</p>
        </div>

        <div id="loginForm" style={{ width: '100%' }}>
          {dadosSalvos ? (
            <div
              className="remember-box"
              style={{ textAlign: "center" }}
            >
              <p style={{ color: 'hsl(var(--foreground))', marginBottom: '5px' }}>
                ● Bem-vindo de volta,
              </p>
              <div className="user-badge" style={{ display: 'inline-block', marginBottom: '15px' }}>
                {dadosSalvos.nome}
              </div>

              <button
                className="btn-primary w-full"
                style={{ marginTop: "10px" }}
                onClick={handleLogin}
              >
                Confirmar e Entrar
              </button>

              <button
                className="btn-ghost"
                style={{ fontSize: "0.75rem", marginTop: "15px", color: 'hsl(var(--muted-foreground))' }}
                onClick={() => {
                  localStorage.removeItem("gt3_remember");
                  setDadosSalvos(null);
                  setForm({ email: "", dataNasc: "" });
                }}
              >
                Usar outra conta
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="form-group">
                <input
                  type="email"
                  placeholder="E-mail cadastrado"
                  value={form.email}
                  onChange={(e) =>
                    setForm({ ...form, email: e.target.value })
                  }
                />
              </div>

              <div className="form-group">
                <input
                  type="date"
                  value={form.dataNasc}
                  onChange={(e) =>
                    setForm({ ...form, dataNasc: e.target.value })
                  }
                />
              </div>

              <button className="btn-primary w-full" onClick={handleLogin}>
                Entrar no Portal
              </button>
            </div>
          )}
        </div>

        {/* Informações de Usabilidade (Cinza) */}
        <p className="usability-info" style={{ marginTop: '20px', fontSize: '0.75rem' }}>
          Utilize suas credenciais cadastradas no programa. Em caso de primeiro acesso, sua senha padrão é sua data de nascimento.
        </p>
      </div>
    </div>
  );
}
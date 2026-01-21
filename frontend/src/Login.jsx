import React from "react";

export default function Login({ form, setForm, handleLogin, dadosSalvos, setDadosSalvos, isDarkMode, setIsDarkMode }) {
  return (
    <div className="login-container">
      <button className="btn-secondary theme-toggle" onClick={() => setIsDarkMode(!isDarkMode)}>
        {isDarkMode ? "◒" : "◓"}
      </button>
      <div className="login-card">
        <div className="brand"><h1>GERAÇÃO <span>TECH 3.0</span></h1></div>
        <div id="loginForm">
          {dadosSalvos ? (
            <div className="remember-box" style={{textAlign: 'center', color: 'white'}}>
              <p>● Bem-vindo de volta, <strong>{dadosSalvos.nome}</strong>!</p>
              <button className="btn-primary" style={{marginTop: '15px'}} onClick={handleLogin}>Confirmar e Entrar</button>
              <button className="btn-secondary" style={{fontSize: '0.6rem', marginTop: '10px'}} onClick={() => { 
                localStorage.removeItem("gt3_remember"); 
                setDadosSalvos(null); 
                setForm({ email: "", dataNasc: "" }); 
              }}>Usar outra conta</button>
            </div>
          ) : (
            <>
              <input placeholder="E-mail cadastrado" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              <input type="date" value={form.dataNasc} onChange={(e) => setForm({ ...form, dataNasc: e.target.value })} />
              <button className="btn-primary" onClick={handleLogin}>Entrar no Portal</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";

export default function RecuperarSenha() {
  const [canal, setCanal] = useState("email"); // "email" | "sms"
  const [valor, setValor] = useState("");
  const [status, setStatus] = useState(null); // null | "enviando" | "enviado" | "erro"

  async function handleSubmit(e) {
    e.preventDefault();
    setStatus("enviando");

    try {
      if (canal === "email") {
        const { error } = await supabase.auth.resetPasswordForEmail(valor);
        if (error) throw error;
      } else {
        // Recuperação por SMS: Supabase Auth usa OTP por telefone (exige
        // um provedor de SMS configurado no projeto, ex. Twilio).
        const { error } = await supabase.auth.signInWithOtp({ phone: valor });
        if (error) throw error;
      }
      setStatus("enviado");
    } catch (err) {
      console.error(err);
      setStatus("erro");
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
      <h1>Recuperar senha</h1>
      <p style={{ color: "var(--text-dim)", marginBottom: 16 }}>Escolha como quer receber o código.</p>

      <div className="tabs">
        <button type="button" className={`tab ${canal === "email" ? "active" : ""}`} onClick={() => setCanal("email")}>
          E-mail
        </button>
        <button type="button" className={`tab ${canal === "sms" ? "active" : ""}`} onClick={() => setCanal("sms")}>
          SMS
        </button>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="field">
          <label>{canal === "email" ? "E-mail cadastrado" : "Telefone cadastrado"}</label>
          <input
            type={canal === "email" ? "email" : "tel"}
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            placeholder={canal === "email" ? "voce@exemplo.com" : "+55 11 91234-5678"}
            required
          />
        </div>

        {status === "enviado" && (
          <p style={{ color: "var(--accent)", fontSize: 14 }}>
            Enviamos as instruções por {canal === "email" ? "e-mail" : "SMS"}.
          </p>
        )}
        {status === "erro" && <p style={{ color: "var(--danger)", fontSize: 14 }}>Não foi possível enviar. Confira o dado e tente de novo.</p>}

        <button type="submit" className="btn btn-primary" style={{ width: "100%" }} disabled={status === "enviando"}>
          {status === "enviando" ? "Enviando..." : "Enviar"}
        </button>
      </form>

      <p style={{ marginTop: 16, fontSize: 14 }}>
        <Link to="/login">Voltar para o login</Link>
      </p>
      </div>
    </div>
  );
}

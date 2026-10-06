import { useEffect, useState } from "react";

// Mostra a data e o horário de agora, sempre visível no topo de cada
// perfil (cliente, coletor, despachante, gerente). Atualiza sozinho —
// não precisa dar refresh na página pra ver a hora certa.

function formatarDataHora(data) {
  const diaSemana = data.toLocaleDateString("pt-BR", { weekday: "long" });
  const diaSemanaCapitalizado = diaSemana.charAt(0).toUpperCase() + diaSemana.slice(1);
  const dataFormatada = data.toLocaleDateString("pt-BR", { day: "2-digit", month: "long" });
  const hora = data.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return `${diaSemanaCapitalizado}, ${dataFormatada} · ${hora}`;
}

export default function RelogioAtual() {
  const [agora, setAgora] = useState(new Date());

  useEffect(() => {
    // Só mostra até o minuto, então atualizar a cada 30s já garante que
    // nunca fica mais de meio minuto desatualizado, sem re-renderizar toda
    // hora à toa.
    const intervalo = setInterval(() => setAgora(new Date()), 30000);
    return () => clearInterval(intervalo);
  }, []);

  return (
    <p style={{ color: "var(--text-dim)", fontSize: 13, margin: "0 0 14px" }}>{formatarDataHora(agora)}</p>
  );
}

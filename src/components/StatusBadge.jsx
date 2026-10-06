const LABELS = {
  pendente: "Pendente",
  aceita: "Aceita",
  // O status interno continua "recusada" (não vale a pena migrar dados
  // antigos por causa de um rótulo), mas não existe mais recusa manual —
  // hoje esse status só nasce do coletor marcando que o cliente não
  // atendeu, então o texto que aparece pra qualquer pessoa é sempre esse,
  // nunca mais a palavra "recusa".
  recusada: "Não atendida",
  coletada: "Coletada",
  disponivel: "Disponível",
  manutencao: "Em manutenção",
  dia_iniciado: "Dia iniciado",
  dia_nao_iniciado: "Não iniciado",
};

// "label" sobrescreve o texto padrão de "status" (útil pro status do dia
// do coletor, que mostra o horário: "Iniciou às 08:15" em vez de só "Dia
// iniciado") — a cor continua vindo da classe "status-<status>".
export default function StatusBadge({ status, label }) {
  return <span className={`status-badge status-${status}`}>{label || LABELS[status] || status}</span>;
}

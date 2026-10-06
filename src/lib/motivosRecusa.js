// Lista padronizada de motivos de recusa — usada tanto pelo gerente quanto
// pelo despachante, pra manter os relatórios/histórico com motivos
// consistentes em vez de texto livre digitado de qualquer jeito.
export const MOTIVOS_RECUSA = [
  { valor: "falta_tempo", label: "Falta de tempo" },
  { valor: "fora_rota", label: "Fora de rota" },
  { valor: "sem_coletor", label: "Sem coletor disponível" },
  { valor: "endereco_nao_atendido", label: "Endereço fora da área de atendimento" },
  { valor: "veiculo_indisponivel", label: "Veículo indisponível" },
  { valor: "outro", label: "Outro motivo" },
];

export const VALOR_OUTRO = "outro";

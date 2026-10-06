// Máscaras e validações usadas nos formulários (cadastro, principalmente).
// Tudo aqui é síncrono e sem dependências externas.

export function mascararCNPJ(valor) {
  return (valor || "")
    .replace(/\D/g, "")
    .slice(0, 14)
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

export function validarCNPJ(cnpjComMascara) {
  const digitos = (cnpjComMascara || "").replace(/\D/g, "");
  if (digitos.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(digitos)) return false; // 00000000000000, 11111111111111 etc.

  const calcularDigito = (base) => {
    const pesos = base.length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const soma = base.split("").reduce((acc, d, i) => acc + Number(d) * pesos[i], 0);
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };

  const base = digitos.slice(0, 12);
  const dv1 = calcularDigito(base);
  const dv2 = calcularDigito(base + dv1);
  return digitos.slice(12) === `${dv1}${dv2}`;
}

export function mascararTelefone(valor) {
  const digitos = (valor || "").replace(/\D/g, "").slice(0, 11);
  let formatado = digitos.replace(/^(\d{2})(\d)/, "($1) $2");
  if (digitos.length > 10) {
    formatado = formatado.replace(/(\d{5})(\d)/, "$1-$2");
  } else {
    formatado = formatado.replace(/(\d{4})(\d)/, "$1-$2");
  }
  return formatado;
}

export function validarTelefone(valor) {
  const digitos = (valor || "").replace(/\D/g, "");
  return digitos.length === 10 || digitos.length === 11;
}

export function mascararCEP(valor) {
  return (valor || "")
    .replace(/\D/g, "")
    .slice(0, 8)
    .replace(/^(\d{5})(\d)/, "$1-$2");
}

export function cepValido(valor) {
  return (valor || "").replace(/\D/g, "").length === 8;
}

export function validarEmail(valor) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor || "");
}

// null = campo vazio (não mostra indicador); senão "fraca" | "media" | "forte".
export function forcaSenha(senha) {
  if (!senha) return null;
  let pontos = 0;
  if (senha.length >= 6) pontos++;
  if (senha.length >= 10) pontos++;
  if (/[a-z]/.test(senha) && /[A-Z]/.test(senha)) pontos++;
  if (/\d/.test(senha)) pontos++;
  if (/[^A-Za-z0-9]/.test(senha)) pontos++;

  if (senha.length < 6 || pontos <= 1) return "fraca";
  if (pontos <= 3) return "media";
  return "forte";
}

export const INFO_FORCA_SENHA = {
  fraca: { label: "Fraca", cor: "var(--danger)" },
  media: { label: "Média", cor: "var(--amber)" },
  forte: { label: "Forte", cor: "var(--accent)" },
};

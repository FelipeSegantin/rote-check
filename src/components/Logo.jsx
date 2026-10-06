// Logo do RoteCheck: envelope (correio) + linhas de movimento (rota /
// coleta) + selo de confirmação (o "check" do nome do app).
export default function Logo({ size = 48 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden focusable="false">
      <rect x="2" y="2" width="60" height="60" rx="16" fill="#0a0a0a" stroke="#ffcc00" strokeWidth="2" />

      <line x1="8" y1="21" x2="14" y2="26" stroke="#ffcc00" strokeWidth="3" strokeLinecap="round" opacity="0.9" />
      <line x1="7" y1="30" x2="13" y2="33" stroke="#ffcc00" strokeWidth="3" strokeLinecap="round" opacity="0.6" />
      <line x1="7" y1="39" x2="12" y2="41" stroke="#ffcc00" strokeWidth="3" strokeLinecap="round" opacity="0.35" />

      <rect x="18" y="21" width="32" height="24" rx="3.5" fill="#ffcc00" />
      <path d="M19.5 24 L34 36 L48.5 24" fill="none" stroke="#0a0a0a" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />

      <circle cx="47" cy="42" r="10" fill="#0a0a0a" stroke="#ffcc00" strokeWidth="2.5" />
      <path d="M42.5 42 L45.5 45.5 L52 38" fill="none" stroke="#ffcc00" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

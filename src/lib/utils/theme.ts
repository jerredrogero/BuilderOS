export function getThemeStyles(builder: {
  primary_color: string | null;
  accent_color: string | null;
}) {
  return {
    "--brand-primary": builder.primary_color || "#1a1a1a",
    "--brand-accent": builder.accent_color || "#2563eb",
  } as React.CSSProperties;
}

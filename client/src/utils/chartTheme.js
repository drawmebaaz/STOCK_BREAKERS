export const chartColors = {
  accent: "#d0a24c",
  accentStrong: "#e0b865",
  teal: "#63c6b8",
  blue: "#8eb3dc",
  green: "#51c58d",
  red: "#ec777a",
  amber: "#dda64a",
  risk: "#d9865d",
  muted: "#8b97a6",
  grid: "#24313d",
  axis: "#8c9aa6",
  panel: "#0c131a",
  border: "#354554",
};

export const chartTooltipProps = {
  contentStyle: {
    background: chartColors.panel,
    border: `1px solid ${chartColors.border}`,
    borderRadius: 8,
    color: "#f4f1ea",
    fontSize: 12,
    boxShadow: "0 14px 32px rgba(0, 0, 0, 0.34)",
  },
  labelStyle: {
    color: "#f4f1ea",
    fontWeight: 700,
    marginBottom: 6,
  },
  itemStyle: {
    color: "#d7dee4",
    padding: "2px 0",
  },
  wrapperStyle: {
    outline: "none",
    zIndex: 20,
  },
};

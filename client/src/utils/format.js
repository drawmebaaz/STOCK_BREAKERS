export const currency = (value, options = {}) => {
  const amount = Number(value ?? 0);
  const maximumFractionDigits = options.maximumFractionDigits ?? 2;
  const minimumFractionDigits = Math.min(options.minimumFractionDigits ?? 2, maximumFractionDigits);
  return amount.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits,
    maximumFractionDigits,
  });
};

export const number = (value, options = {}) =>
  Number(value ?? 0).toLocaleString("en-US", {
    minimumFractionDigits: options.minimumFractionDigits ?? 0,
    maximumFractionDigits: options.maximumFractionDigits ?? 2,
  });

export const signedPercent = (value, digits = 2) => {
  const amount = Number(value ?? 0);
  return `${amount >= 0 ? "+" : ""}${amount.toFixed(digits)}%`;
};

export const titleFromCode = (value) =>
  String(value || "")
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");

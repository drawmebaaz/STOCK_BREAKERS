export const currency = (value, options = {}) => {
  const amount = Number(value ?? 0);
  return amount.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: options.minimumFractionDigits ?? 2,
    maximumFractionDigits: options.maximumFractionDigits ?? 2,
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

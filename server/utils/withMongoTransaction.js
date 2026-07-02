import mongoose from "mongoose";

let warnedAboutTransactionFallback = false;

const transactionUnavailablePatterns = [
  "Transaction numbers are only allowed",
  "replica set member or mongos",
  "Transactions are not supported",
  "TransactionNotSupported",
  "IllegalOperation",
];

export const isTransactionUnavailableError = (err) => {
  const text = `${err?.message || ""} ${err?.codeName || ""}`;
  return transactionUnavailablePatterns.some((pattern) => text.includes(pattern));
};

export const withMongoTransaction = async (fn, { allowFallback = true } = {}) => {
  if (mongoose.connection.readyState !== 1) {
    return fn(null);
  }

  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      result = await fn(session);
    });
    return result;
  } catch (err) {
    if (allowFallback && isTransactionUnavailableError(err)) {
      if (!warnedAboutTransactionFallback) {
        warnedAboutTransactionFallback = true;
        console.warn("MongoDB transactions unavailable; using safe sequential order-accounting fallback.");
      }
      return fn(null);
    }
    throw err;
  } finally {
    await session.endSession();
  }
};

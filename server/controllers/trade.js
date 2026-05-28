import { User, Holding, Transaction } from "../models/index.js";
import { getPriceMap } from "../utils/priceStore.js";

const getLivePrice = (ticker) => {
  const price = getPriceMap()[ticker];
  return typeof price === "number" && Number.isFinite(price) ? price : null;
};

export const buyStock = async (req, res, next) => {
  try {
    const { ticker, quantity } = req.body;
    const price = getLivePrice(ticker);
    if (!price) return res.status(404).json({ error: "Stock not found" });

    const total = +(quantity * price).toFixed(2);
    const user = await User.findOneAndUpdate(
      { _id: req.user._id, cashBalance: { $gte: total } },
      { $inc: { cashBalance: -total } },
      { new: true, runValidators: true }
    );
    if (!user) return res.status(400).json({ error: "Insufficient funds" });

    let holding = await Holding.findOne({ userId: user._id, ticker });
    if (holding) {
      const newQty = holding.quantity + quantity;
      holding.avgCost = +((holding.totalInvested + total) / newQty).toFixed(4);
      holding.quantity = newQty;
      holding.totalInvested = +(holding.totalInvested + total).toFixed(2);
    } else {
      holding = new Holding({
        userId: user._id,
        ticker,
        quantity,
        avgCost: price,
        totalInvested: total,
      });
    }
    await holding.save();

    await Transaction.create({ userId: user._id, type: "buy", ticker, quantity, price, total });

    res.json({ success: true, cashBalance: user.cashBalance });
  } catch (err) {
    next(err);
  }
};

export const sellStock = async (req, res, next) => {
  try {
    const { ticker, quantity } = req.body;
    const price = getLivePrice(ticker);
    if (!price) return res.status(404).json({ error: "Stock not found" });

    const user = await User.findById(req.user._id);
    const holding = await Holding.findOne({ userId: user._id, ticker });

    if (!holding || holding.quantity < quantity)
      return res.status(400).json({ error: "Not enough shares" });

    const total = +(quantity * price).toFixed(2);

    holding.quantity -= quantity;
    holding.totalInvested = +(holding.totalInvested - holding.avgCost * quantity).toFixed(2);

    if (holding.quantity === 0) {
      await holding.deleteOne();
    } else {
      await holding.save();
    }

    user.cashBalance = +(user.cashBalance + total).toFixed(2);
    await user.save();

    await Transaction.create({ userId: user._id, type: "sell", ticker, quantity, price, total });

    res.json({ success: true, cashBalance: user.cashBalance });
  } catch (err) {
    next(err);
  }
};

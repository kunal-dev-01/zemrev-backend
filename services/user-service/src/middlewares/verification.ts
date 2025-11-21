import { Request, Response, NextFunction } from "express";

export const verifyServiceToken = (req: Request, res: Response, next: NextFunction) => {
  const serviceToken = req.headers["x-service-token"];
  const serviceId = req.headers["x-service-id"];

  if (!serviceToken || !serviceId) {
    return res.status(401).json({ error: "Service token required" });
  }

  next();
};

export const requireCreditDeduction = (req: Request, res: Response, next: NextFunction) => {
  const { userId, creditsNeeded } = req.body;

  if (!userId || !creditsNeeded) {
    return res.status(400).json({ error: "userId and creditsNeeded required" });
  }

  next();
};
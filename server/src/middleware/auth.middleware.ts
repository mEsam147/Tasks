import jwt from "jsonwebtoken";
import { Request, Response, NextFunction } from "express";
import type { IUser } from "../models/user.model"; // Correctly importing User as a type
import User from "../models/user.model"; // Correctly importing User as a type

declare global {
  namespace Express {
    interface Request {
      user: IUser;
    }
  }
}

export const authMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token = req.cookies?.token;

    if (!token) {
      res.status(401).json({ message: "Unauthorized - No token provided" });
      return;
    }

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET as string
    ) as jwt.JwtPayload;

    const user = await User.findById(decoded.userId).select("-password");

    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    req.user = user; // Should now work with proper typing
    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      res.status(401).json({ message: "Unauthorized - Invalid token" });
      return;
    }

    console.error(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

import { Request, Response } from "express";
import User from "../models/user.model";
import { scrapeLinkedInProfile } from "../services/linkedin";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

export const Register = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, email, password, linkedinUrl } = req.body;

    if (!email || !password) {
      res.status(400).json({ message: "Email and password are required" });
      return;
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      res.status(400).json({ message: "User already exists" });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({
      name,
      email,
      password: hashedPassword,
      linkedinUrl,
    }) as typeof User.prototype;

    if (linkedinUrl) {
      const linkedinProfile = await scrapeLinkedInProfile(linkedinUrl);
      if (linkedinProfile) {
        newUser.linkedinProfile = linkedinProfile;
        console.log("LinkedIn profile scraped:", linkedinProfile);
      } else {
        console.log("Failed to scrape LinkedIn profile");
      }
    }
    await newUser.save();

    const payload = { userId: newUser._id.toString() };
    const token = jwt.sign(payload, process.env.JWT_SECRET as string, {
      expiresIn: "2h",
    });
    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 3600000,
    } as any);
    res.status(201).json({
      message: "User created successfully",
      user: {
        ...newUser._doc,
        password: undefined,
      },
    });
  } catch (error) {
    if (error instanceof Error) {
      console.error(error.message);
      res.status(500).json({ message: error.message });
    }
  }
};
export const Login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body as { email: string; password: string };

    if (!email || !password) {
      res.status(400).json({ message: "Email and password are required" });
      return;
    }

    const user = (await User.findOne({ email })) as typeof User.prototype;
    if (!user) {
      res.status(400).json({ message: "User does not exist" });
      return;
    }

    const isValidPassword = await user.matchPassword(password);

    console.log(isValidPassword);

    if (!isValidPassword) {
      res.status(400).json({ message: "Invalid password" });
      return;
    }

    const payload = { userId: user._id.toString() };
    const token = jwt.sign(payload, process.env.JWT_SECRET as string, {
      expiresIn: "1h",
    });

    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 3600000, // 1 hour
    });

    res.status(200).json({
      message: "Logged in successfully",
      user: { ...user.toObject(), password: undefined },
    });
  } catch (error) {
    if (error instanceof Error) {
      console.error(error.message);
      res.status(500).json({ message: error.message });
    }
  }
};

export const logout = async (req: Request, res: Response) => {
  try {
    res.clearCookie("token");
    res.json({ message: "Logged out successfully" });
  } catch (error) {
    if (error instanceof Error) {
      console.log(error);
      res.status(500).json({ message: error.message });
    }
  }
};

export const getCurrentUser = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const currentUser = req?.user._id;
    if (!currentUser) {
      res.status(401).json({ message: "Please login first" });
    }
    res.json({
      user: req.user,
    });
  } catch (error) {
    if (error instanceof Error) {
      console.log(error);
      res.status(500).json({ message: error.message });
    }
  }
};

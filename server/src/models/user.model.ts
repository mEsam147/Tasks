import mongoose, { Schema, Document } from "mongoose";
import bcrypt from "bcryptjs";

interface ILinkedInProfile {
  name: string;
  photoUrl: string;
  profileUrl: string;
}

export interface IUser extends Document {
  name: string;
  email: string;
  password: string;
  linkedinUrl?: string;
  linkedinProfile?: ILinkedInProfile;
  matchPassword(enteredPassword: string): Promise<boolean>;
}

const userSchema: Schema<IUser> = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true, minlength: 6 },
    linkedinUrl: { type: String, required: true },
    linkedinProfile: {
      name: { type: String },
      photoUrl: { type: String },
      profileUrl: { type: String },
    },
  },
  { timestamps: true }
);



userSchema.methods.matchPassword = async function (
  enteredPassword: string
): Promise<boolean> {
  if (!this.password) return false;
  return await bcrypt.compare(enteredPassword, this.password);
};

export default mongoose.model<IUser>("User", userSchema);

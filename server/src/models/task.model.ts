import mongoose, { Schema, Document } from "mongoose";

interface ITask extends Document {
  user: mongoose.Types.ObjectId;
  title: string;
  description?: string;
  dueDate: String;
  completed: boolean;
  category: string;
}

const taskSchema: Schema<ITask> = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    title: { type: String, required: true },
    description: { type: String },
    dueDate: { type: String, default: new Date().toISOString() },
    completed: { type: Boolean, default: false },
    category: { type: String, default: "Uncategorized" },
  },
  { timestamps: true }
);

export default mongoose.model<ITask>("Task", taskSchema);

import { Request, Response } from "express";
import Task from "../models/task.model";

export const GetTasks = async (req: Request, res: Response): Promise<void> => {
  const { search, category, dueDate } = req.query as {
    search?: string;
    category?: string;
    dueDate?: string;
  };
  try {
    let query: any = { user: req.user?._id };
    if (search) {
      query = {
        ...query,
        $or: [
          { title: { $regex: search, $options: "i" } },
          { description: { $regex: search, $options: "i" } },
          { category: { $regex: search, $options: "i" } },
        ],
      };
    }
    if (category) {
      query.category = category;
    }
    if (dueDate) {
      let normalizedDueDate: string;
      try {
        normalizedDueDate = new Date(dueDate).toISOString().split("T")[0];
      } catch {
        normalizedDueDate = dueDate.split("T")[0];
      }
      query.dueDate = { $regex: `^${normalizedDueDate}`, $options: "i" };
    }
    const tasks = await Task.find(query).sort({
      completed: 1,
      createdAt: -1,
    });

    res.status(200).json(tasks);
  } catch (error) {
    if (error instanceof Error) {
      console.log(error);
      res.status(500).json({ message: error.message });
    }
  }
};
export const createTask = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { title, description, dueDate, category } = req.body as {
    title: string;
    description?: string;
    dueDate: string;
    category?: string;
  };
  try {
    const task = new Task({
      user: req.user?._id,
      title,
      description,
      dueDate,
      category,
    });
    await task.save();
    res.status(201).json(task);
  } catch (error) {
    if (error instanceof Error) {
      console.log(error);
      res.status(500).json({ message: error.message });
    }
  }
};

export const updateTask = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { title, description, dueDate, completed, category } = req.body as {
    title?: string;
    description?: string;
    dueDate?: string;
    completed?: boolean;
    category?: string;
  };
  const { taskId } = req.params;
  try {
    const task = await Task.findOneAndUpdate(
      { _id: taskId, user: req?.user?._id },
      {
        title,
        description,
        dueDate: dueDate ? new Date(dueDate) : undefined,
        completed,
        category,
      },
      { new: true }
    );
    if (!task) {
      res.status(404).json({ message: "Task not found" });
      return;
    }
    res.json(task);
  } catch (error) {
    if (error instanceof Error) {
      console.log(error);
      res.status(500).json({ message: error.message });
    }
  }
};

export const deleteTask = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { taskId } = req.params;

  try {
    const currentUser = req?.user?._id;
    const task = await Task.findOneAndDelete({
      _id: taskId,
      user: currentUser,
    });
    if (!task) {
      res.status(404).json({ message: "Task not found" });
    }
    res.json({ message: "Task deleted Successfully" });
  } catch (error) {
    if (error instanceof Error) {
      console.log(error);
      res.status(500).json({ message: error.message });
    }
  }
};

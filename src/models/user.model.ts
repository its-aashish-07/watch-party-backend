import { model, models, Schema, type Model } from "mongoose";

export interface UserDocument {
  _id: string;
  name: string;
  email: string;
  passwordHash: string;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<UserDocument>({
  _id: { type: String, required: true },
  name: { type: String, required: true, trim: true, minlength: 2, maxlength: 60 },
  email: { type: String, required: true, trim: true, lowercase: true, unique: true, index: true },
  passwordHash: { type: String, required: true, select: false }
}, {
  timestamps: true,
  versionKey: false,
  collection: "users"
});

export const UserModel = (models.User as Model<UserDocument> | undefined) ?? model<UserDocument>("User", userSchema);

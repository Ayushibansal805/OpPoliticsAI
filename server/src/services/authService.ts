import argon2 from 'argon2';
import { UserModel, type UserDocument } from '../models/User.js';

export async function hashPassword(password: string) {
  return argon2.hash(password, { type: argon2.argon2id });
}

export async function verifyPassword(user: UserDocument, password: string) {
  return argon2.verify(String(user.passwordHash), password);
}

export async function findUserForLogin(email: string) {
  return UserModel.findOne({ email }).select('+passwordHash');
}

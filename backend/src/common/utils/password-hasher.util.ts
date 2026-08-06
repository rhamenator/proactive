import bcrypt from 'bcrypt';

export const passwordHasher = {
  async hash(value: string, rounds: number) {
    return bcrypt.hash(value, rounds);
  },
  async compare(value: string, hash: string) {
    return bcrypt.compare(value, hash);
  }
};

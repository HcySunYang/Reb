import bcrypt from 'bcrypt';
import { createInterface } from 'readline';

const rl = createInterface({ input: process.stdin, output: process.stdout });

rl.question('Enter the auth token you want to use: ', async (token) => {
  if (!token || token.length < 8) {
    console.error('Token must be at least 8 characters.');
    process.exit(1);
  }
  const hash = await bcrypt.hash(token, 12);
  console.log('\nAdd this to your .env file:\n');
  console.log(`AUTH_TOKEN_HASH=${hash}`);
  console.log('\nUse this token in your iOS app to connect.');
  rl.close();
});

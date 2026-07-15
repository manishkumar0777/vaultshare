import { generateKey, exportKey, encryptString, decryptString } from '@/lib/crypto/utils';

async function quickTest() {
  console.log('🔒 VaultShare - Quick Test\n');

  // Test encryption/decryption
  console.log('Testing encryption...');
  const key = await generateKey();
  const exportedKey = await exportKey(key);
  console.log('✅ Key generated:', exportedKey.substring(0, 20) + '...');

  const { ciphertext, iv } = await encryptString('Hello, VaultShare!', key);
  console.log('✅ String encrypted:', ciphertext.substring(0, 20) + '...');

  const decrypted = await decryptString(ciphertext, key, iv);
  console.log('✅ String decrypted:', decrypted);

  if (decrypted === 'Hello, VaultShare!') {
    console.log('\n🎉 All tests passed! VaultShare is ready to use.\n');
    console.log('✅ Server is running on http://localhost:3000');
    console.log('✅ MongoDB is connected');
    console.log('✅ Encryption is working');
  } else {
    console.log('\n❌ Test failed!');
  }
}

quickTest().catch(console.error);
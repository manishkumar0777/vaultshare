import { generateKey, exportKey, encryptFile, encryptString, decryptFile, decryptString } from '@/lib/crypto/utils';
import fs from 'fs';
import path from 'path';

async function testEncryption() {
  try {
    // Read test file
    const filePath = path.join(process.cwd(), 'test-file.txt');
    const fileContent = fs.readFileSync(filePath);
    const file = new File([fileContent], 'test-file.txt', { type: 'text/plain' });
    const originalContent = new TextDecoder().decode(fileContent);

    console.log('Original file:', file.name, file.size, 'bytes');
    console.log('Original content:', originalContent);

    // Generate encryption key
    const key = await generateKey();
    const exportedKey = await exportKey(key);
    console.log('Generated key:', exportedKey);

    // Encrypt the file
    const { ciphertext, iv } = await encryptFile(file, key);
    console.log('Encrypted file size:', ciphertext.byteLength, 'bytes');

    // Encrypt metadata
    const { ciphertext: nameCiphertext, iv: nameIv } = await encryptString(file.name, key);
    const { ciphertext: mimeCiphertext, iv: mimeIv } = await encryptString(file.type, key);
    console.log('Encrypted filename:', nameCiphertext);
    console.log('Encrypted MIME type:', mimeCiphertext);

    // Test decryption
    const decryptedData = await decryptFile(ciphertext, key, iv);
    const decryptedText = new TextDecoder().decode(decryptedData);
    console.log('Decrypted content:', decryptedText);

    // Test string decryption
    const decryptedName = await decryptString(nameCiphertext, key, nameIv);
    const decryptedMime = await decryptString(mimeCiphertext, key, mimeIv);
    console.log('Decrypted filename:', decryptedName);
    console.log('Decrypted MIME type:', decryptedMime);

    // Verify the decrypted content matches the original
    if (decryptedText === originalContent) {
      console.log('✅ Encryption/decryption test passed!');
      return true;
    } else {
      console.log('❌ Encryption/decryption test failed!');
      console.log('Expected:', originalContent);
      console.log('Got:', decryptedText);
      return false;
    }
  } catch (error) {
    console.error('Test error:', error);
    return false;
  }
}

// Run the test
testEncryption().then(success => {
  process.exit(success ? 0 : 1);
});
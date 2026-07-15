import { generateKey, exportKey, encryptFile, encryptString, importKey, decryptFile, base64ToIV, ivToBase64 } from '@/lib/crypto/utils';
import fs from 'fs';
import path from 'path';

async function testEndToEnd() {
  console.log('🔒 VaultShare - End-to-End Test with Simple Route\n');

  try {
    // 1. Create a test file
    const filePath = path.join(process.cwd(), 'test-file.txt');
    const fileContent = "This is a test file for VaultShare end-to-end testing.";
    fs.writeFileSync(filePath, fileContent);
    const file = new File([fileContent], 'test-file.txt', { type: 'text/plain' });
    console.log('✅ Test file created:', file.name, file.size, 'bytes');

    // 2. Generate encryption key
    const key = await generateKey();
    const exportedKey = await exportKey(key);
    console.log('✅ Encryption key generated');

    // 3. Encrypt the file
    const { ciphertext, iv } = await encryptFile(file, key);
    console.log('✅ File encrypted:', ciphertext.byteLength, 'bytes');

    // 4. Encrypt metadata
    const { ciphertext: nameCiphertext, iv: nameIv } = await encryptString(file.name, key);
    const { ciphertext: mimeCiphertext, iv: mimeIv } = await encryptString(file.type, key);
    console.log('✅ Metadata encrypted');

    // 5. Create FormData for upload
    const formData = new FormData();
    formData.append('file', new Blob([ciphertext]), 'encrypted.bin');
    formData.append('iv', ivToBase64(iv));
    formData.append('originalNameEncrypted', `${nameIv}:${nameCiphertext}`);
    formData.append('mimeTypeEncrypted', `${mimeIv}:${mimeCiphertext}`);
    formData.append('downloadLimit', '1'); // Burn after reading
    formData.append('expiresInHours', '24');
    formData.append('size', file.size.toString());

    // 6. Upload to server
    console.log('📤 Uploading to server...');
    const uploadResponse = await fetch('http://localhost:3000/api/files/simple', {
      method: 'POST',
      body: formData
    });

    if (!uploadResponse.ok) {
      const errorData = await uploadResponse.json();
      throw new Error(`Upload failed: ${errorData.error || 'Unknown error'}`);
    }

    const uploadResult = await uploadResponse.json();
    console.log('✅ Upload successful!');
    console.log('   File ID:', uploadResult.fileId);
    console.log('   Share URL:', uploadResult.shareUrl);
    console.log('   Expires at:', new Date(uploadResult.expiresAt).toLocaleString());

    // 7. Extract file ID and key from URL
    const fileId = uploadResult.fileId;
    let shareUrl = uploadResult.shareUrl;
    if (shareUrl && !shareUrl.includes('#key=')) {
      shareUrl = `${shareUrl}#key=${encodeURIComponent(exportedKey)}`;
    }
    const url = new URL(shareUrl);
    const hashParams = new URLSearchParams(url.hash.substring(1));
    const keyFromUrl = hashParams.get('key');

    if (!keyFromUrl) {
      throw new Error('No decryption key found in URL');
    }

    // 8. Get file metadata
    console.log('\n🔍 Fetching file metadata...');
    const metaResponse = await fetch(`http://localhost:3000/api/files/simple/${fileId}/meta`);
    if (!metaResponse.ok) {
      const errorData = await metaResponse.json();
      throw new Error(`Failed to get file metadata: ${errorData.error || 'Unknown error'}`);
    }
    const meta = await metaResponse.json();
    console.log('✅ File metadata retrieved:');
    console.log('   Size:', meta.size, 'bytes');
    console.log('   Downloads remaining:', meta.downloadsRemaining);
    console.log('   Expires at:', new Date(meta.expiresAt).toLocaleString());

    // 9. Download the file
    console.log('\n📥 Downloading file...');
    const downloadResponse = await fetch(`http://localhost:3000/api/files/simple/${fileId}`);
    if (!downloadResponse.ok) {
      const errorData = await downloadResponse.json();
      throw new Error(`Failed to download file: ${errorData.error || 'Unknown error'}`);
    }

    // 10. Get IV from headers
    const ivBase64 = downloadResponse.headers.get('X-File-IV');
    if (!ivBase64) {
      throw new Error('Missing IV in response headers');
    }

    const encryptedData = await downloadResponse.arrayBuffer();
    console.log('✅ File downloaded:', encryptedData.byteLength, 'bytes');

    // 11. Import the decryption key
    const importedKey = await importKey(decodeURIComponent(keyFromUrl));

    // 12. Decrypt the file
    const ivBuffer = base64ToIV(ivBase64);
    const decryptedData = await decryptFile(encryptedData, importedKey, ivBuffer);
    const decryptedText = new TextDecoder().decode(decryptedData);
    console.log('✅ File decrypted:', decryptedText.length, 'characters');

    // 13. Verify the content
    if (decryptedText === fileContent) {
      console.log('\n🎉 End-to-end test PASSED!');
      console.log('   Original content matches decrypted content');
      console.log('   ✅ Encryption/decryption works');
      console.log('   ✅ Upload/download works');
      console.log('   ✅ End-to-end flow works');
      return true;
    } else {
      console.log('\n❌ End-to-end test FAILED!');
      console.log('   Original:', fileContent);
      console.log('   Decrypted:', decryptedText);
      return false;
    }
  } catch (error) {
    console.error('\n❌ Test failed:', error instanceof Error ? error.message : error);
    return false;
  }
}

testEndToEnd().then(success => {
  process.exit(success ? 0 : 1);
});
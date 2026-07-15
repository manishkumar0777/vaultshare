import fs from 'fs';
import path from 'path';

async function testUpload() {
  try {
    // Create a test file
    const filePath = path.join(process.cwd(), 'test-file.txt');
    const fileContent = "This is a test file for VaultShare.";
    fs.writeFileSync(filePath, fileContent);

    const file = new File([fileContent], 'test-file.txt', { type: 'text/plain' });
    console.log('Created test file:', file.name, file.size, 'bytes');

    // Create FormData for upload
    const formData = new FormData();
    formData.append('file', file);
    formData.append('downloadLimit', '1');
    formData.append('expiresInHours', '24');

    // Upload to server
    console.log('Uploading to server...');
    const response = await fetch('http://localhost:3000/api/files', {
      method: 'POST',
      body: formData
    });

    console.log('Response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));

    // Try to get the response text
    const responseText = await response.text();
    console.log('Response text:', responseText);

    if (!response.ok) {
      console.log('Upload failed');
      return false;
    }

    return true;
  } catch (error) {
    console.error('Test error:', error);
    return false;
  }
}

// Run the test
testUpload().then(success => {
  process.exit(success ? 0 : 1);
});
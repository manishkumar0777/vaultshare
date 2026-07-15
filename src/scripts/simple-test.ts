async function simpleUploadTest() {
  console.log('📤 Simple Upload Test\n');

  try {
    // Create a simple text file
    const fileContent = "This is a simple test file.";
    const file = new File([fileContent], 'simple-test.txt', { type: 'text/plain' });

    // Create FormData
    const formData = new FormData();
    formData.append('file', file);
    formData.append('downloadLimit', '1');
    formData.append('expiresInHours', '24');

    // Upload to server
    console.log('Uploading to server...');
    const response = await fetch('http://localhost:3000/api/files/simple', {
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

    const result = JSON.parse(responseText);
    console.log('✅ Upload successful!');
    console.log('   File ID:', result.fileId);
    console.log('   Share URL:', result.shareUrl);
    console.log('   Expires at:', new Date(result.expiresAt).toLocaleString());

    return true;
  } catch (error) {
    console.error('Test error:', error);
    return false;
  }
}

simpleUploadTest().then(success => {
  process.exit(success ? 0 : 1);
});
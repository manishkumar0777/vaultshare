async function debugUpload() {
  console.log('🔍 Debugging upload...');

  try {
    const fileContent = "This is a test file.";
    const file = new File([fileContent], 'test-file.txt', { type: 'text/plain' });

    const formData = new FormData();
    formData.append('file', file);
    formData.append('downloadLimit', '1');
    formData.append('expiresInHours', '24');

    console.log('Sending request to http://localhost:3000/api/files/simple');
    const response = await fetch('http://localhost:3000/api/files/simple', {
      method: 'POST',
      body: formData
    });

    console.log('Response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));

    const responseText = await response.text();
    console.log('Response text:', responseText);

    if (!response.ok) {
      console.log('Upload failed');
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error:', error);
    return false;
  }
}

debugUpload().then(success => {
  process.exit(success ? 0 : 1);
});
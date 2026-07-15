async function debugMetadata() {
  console.log('🔍 Debugging metadata...');

  try {
    // First upload a file
    const fileContent = "This is a test file.";
    const file = new File([fileContent], 'test-file.txt', { type: 'text/plain' });

    const formData = new FormData();
    formData.append('file', file);
    formData.append('downloadLimit', '1');
    formData.append('expiresInHours', '24');

    const uploadResponse = await fetch('http://localhost:3000/api/files/simple', {
      method: 'POST',
      body: formData
    });

    if (!uploadResponse.ok) throw new Error('Upload failed');
    const uploadResult = await uploadResponse.json();
    console.log('✅ Upload successful:', uploadResult.fileId);

    const fileId = uploadResult.fileId;

    // Test metadata
    console.log('Testing metadata...');
    const metaResponse = await fetch(`http://localhost:3000/api/files/simple/${fileId}/meta`);
    console.log('Metadata response status:', metaResponse.status);

    const metaText = await metaResponse.text();
    console.log('Metadata response text:', metaText);

    if (!metaResponse.ok) throw new Error('Metadata fetch failed');
    const meta = JSON.parse(metaText);
    console.log('✅ Metadata works:', meta);

    // Test file list
    console.log('\nTesting file list...');
    const listResponse = await fetch('http://localhost:3000/api/files/list');
    console.log('List response status:', listResponse.status);
    const listText = await listResponse.text();
    console.log('List response text:', listText);

    if (!listResponse.ok) throw new Error('File list failed');
    const list = JSON.parse(listText);
    console.log('✅ File list works:', list.files.length, 'files');

    // Test download
    console.log('\nTesting download...');
    const downloadResponse = await fetch(`http://localhost:3000/api/files/simple/${fileId}`);
    console.log('Download response status:', downloadResponse.status);
    if (downloadResponse.ok) {
      console.log('✅ Download works');
      console.log('Content-Type:', downloadResponse.headers.get('Content-Type'));
      console.log('X-File-IV:', downloadResponse.headers.get('X-File-IV'));
    }

  } catch (error) {
    console.error('Error:', error);
  }
}

debugMetadata();